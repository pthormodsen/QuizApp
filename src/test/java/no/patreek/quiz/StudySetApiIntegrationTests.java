package no.patreek.quiz;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * End-to-end coverage for study set and term CRUD: validation, ownership isolation,
 * deterministic term ordering, reordering, and cascading set deletion.
 */
@SuppressWarnings("unchecked")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class StudySetApiIntegrationTests {

    @Autowired
    private TestRestTemplate restTemplate;

    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.com";
    }

    private String registerAndGetToken(String prefix) {
        ResponseEntity<Map> response = restTemplate.postForEntity(
                "/api/auth/register",
                Map.of("email", uniqueEmail(prefix), "password", "validPass1"),
                Map.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return (String) response.getBody().get("token");
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return headers;
    }

    private <T> ResponseEntity<T> authGet(String path, String token, Class<T> type) {
        return restTemplate.exchange(path, HttpMethod.GET, new HttpEntity<>(authHeaders(token)), type);
    }

    private <T> ResponseEntity<T> authPost(String path, String token, Object body, Class<T> type) {
        return restTemplate.exchange(path, HttpMethod.POST, new HttpEntity<>(body, authHeaders(token)), type);
    }

    private <T> ResponseEntity<T> authPatch(String path, String token, Object body, Class<T> type) {
        return restTemplate.exchange(path, HttpMethod.PATCH, new HttpEntity<>(body, authHeaders(token)), type);
    }

    private <T> ResponseEntity<T> authDelete(String path, String token, Class<T> type) {
        return restTemplate.exchange(path, HttpMethod.DELETE, new HttpEntity<>(authHeaders(token)), type);
    }

    // ---- CRUD + validation ----

    @Test
    void studySet_crudRoundTrip_withOptionalDescription() {
        String token = registerAndGetToken("setcrud");

        ResponseEntity<Map> created = authPost(
                "/api/study-sets", token, Map.of("title", "  Spanish verbs  "), Map.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Integer setId = (Integer) created.getBody().get("id");
        assertThat(created.getBody().get("title")).isEqualTo("Spanish verbs");
        assertThat(created.getBody().get("description")).isNull();
        assertThat(created.getBody().get("termCount")).isEqualTo(0);

        ResponseEntity<Map> updated = authPatch("/api/study-sets/" + setId, token,
                Map.of("title", "Spanish verbs 2", "description", "Irregulars"), Map.class);
        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody().get("description")).isEqualTo("Irregulars");

        List<Map<String, Object>> sets = authGet("/api/study-sets", token, List.class).getBody();
        assertThat(sets).extracting(s -> s.get("id")).containsExactly(setId);

        assertThat(authDelete("/api/study-sets/" + setId, token, Void.class).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(authGet("/api/study-sets/" + setId, token, Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void createStudySet_blankTitle_returns400WithFieldError() {
        String token = registerAndGetToken("setblank");

        ResponseEntity<Map> response = authPost(
                "/api/study-sets", token, Map.of("title", "  "), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat((Map<String, Object>) response.getBody().get("fieldErrors")).containsKey("title");
    }

    @Test
    void createTerm_blankDefinition_returns400WithFieldError() {
        String token = registerAndGetToken("termblank");
        Integer setId = createSet(token, "Set");

        ResponseEntity<Map> response = authPost("/api/study-sets/" + setId + "/terms", token,
                Map.of("term", "hola", "definition", " "), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat((Map<String, Object>) response.getBody().get("fieldErrors")).containsKey("definition");
    }

    @Test
    void studySets_requireAuthentication() {
        ResponseEntity<Map> response = restTemplate.getForEntity("/api/study-sets", Map.class);
        assertThat(response.getStatusCode().is4xxClientError()).isTrue();
    }

    // ---- Ownership isolation ----

    @Test
    void studySet_isNotVisibleOrEditableByAnotherUser() {
        String ownerToken = registerAndGetToken("setowner");
        String otherToken = registerAndGetToken("setintruder");
        Integer setId = createSet(ownerToken, "Owner Set");

        assertThat(authGet("/api/study-sets/" + setId, otherToken, Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authPatch("/api/study-sets/" + setId, otherToken,
                Map.of("title", "Hijacked"), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authDelete("/api/study-sets/" + setId, otherToken, Void.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat((List<?>) authGet("/api/study-sets", otherToken, List.class).getBody()).isEmpty();

        ResponseEntity<Map> ownerView = authGet("/api/study-sets/" + setId, ownerToken, Map.class);
        assertThat(ownerView.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(ownerView.getBody().get("title")).isEqualTo("Owner Set");
    }

    @Test
    void terms_areNotCreatableVisibleOrEditableForAnotherUsersSet() {
        String ownerToken = registerAndGetToken("termowner");
        String otherToken = registerAndGetToken("termintruder");
        Integer setId = createSet(ownerToken, "Owner Set");
        Integer termId = createTerm(ownerToken, setId, "perro", "dog");
        String termsPath = "/api/study-sets/" + setId + "/terms";

        assertThat(authPost(termsPath, otherToken,
                Map.of("term", "sneaky", "definition", "x"), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authGet(termsPath, otherToken, List.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authPatch(termsPath + "/" + termId, otherToken,
                Map.of("term", "gato", "definition", "cat"), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authDelete(termsPath + "/" + termId, otherToken, Void.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authPatch(termsPath + "/reorder", otherToken,
                Map.of("termIds", List.of(termId)), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);

        List<Map<String, Object>> terms = authGet(termsPath, ownerToken, List.class).getBody();
        assertThat(terms).singleElement().satisfies(t -> assertThat(t.get("term")).isEqualTo("perro"));
    }

    @Test
    void term_cannotBeAddressedThroughADifferentSetOfTheSameOwner() {
        String token = registerAndGetToken("crossset");
        Integer setA = createSet(token, "A");
        Integer setB = createSet(token, "B");
        Integer termInA = createTerm(token, setA, "uno", "one");

        assertThat(authPatch("/api/study-sets/" + setB + "/terms/" + termInA, token,
                Map.of("term", "dos", "definition", "two"), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authDelete("/api/study-sets/" + setB + "/terms/" + termInA, token, Void.class)
                .getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ---- Ordering ----

    @Test
    void terms_keepInsertionOrder_andNewTermsAppendAfterDeletion() {
        String token = registerAndGetToken("termorder");
        Integer setId = createSet(token, "Ordered");
        String termsPath = "/api/study-sets/" + setId + "/terms";

        Integer t1 = createTerm(token, setId, "one", "1");
        Integer t2 = createTerm(token, setId, "two", "2");
        Integer t3 = createTerm(token, setId, "three", "3");

        authDelete(termsPath + "/" + t1, token, Void.class);
        Integer t4 = createTerm(token, setId, "four", "4");

        List<Map<String, Object>> terms = authGet(termsPath, token, List.class).getBody();
        assertThat(terms).extracting(t -> t.get("id")).containsExactly(t2, t3, t4);

        Map<String, Object> set = authGet("/api/study-sets/" + setId, token, Map.class).getBody();
        assertThat(set.get("termCount")).isEqualTo(3);
    }

    @Test
    void reorderTerms_persistsNewOrderAndRejectsMismatchedIds() {
        String token = registerAndGetToken("termreorder");
        Integer setId = createSet(token, "Reorder");
        String termsPath = "/api/study-sets/" + setId + "/terms";

        Integer t1 = createTerm(token, setId, "a", "1");
        Integer t2 = createTerm(token, setId, "b", "2");
        Integer t3 = createTerm(token, setId, "c", "3");

        ResponseEntity<List> reorderResponse = authPatch(termsPath + "/reorder", token,
                Map.of("termIds", List.of(t3, t1, t2)), List.class);
        assertThat(reorderResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((List<Map<String, Object>>) reorderResponse.getBody())
                .extracting(t -> t.get("id")).containsExactly(t3, t1, t2);

        List<Map<String, Object>> reordered = authGet(termsPath, token, List.class).getBody();
        assertThat(reordered).extracting(t -> t.get("id")).containsExactly(t3, t1, t2);
        assertThat(reordered).extracting(t -> t.get("orderIndex")).containsExactly(0, 1, 2);

        assertThat(authPatch(termsPath + "/reorder", token,
                Map.of("termIds", List.of(t1, t2)), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(authPatch(termsPath + "/reorder", token,
                Map.of("termIds", List.of(t1, t1, t2)), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ---- Deletion ----

    @Test
    void deletingStudySet_removesItsTerms() {
        String token = registerAndGetToken("setdelete");
        Integer setId = createSet(token, "Doomed");
        Integer termId = createTerm(token, setId, "adios", "goodbye");

        assertThat(authDelete("/api/study-sets/" + setId, token, Void.class).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(authGet("/api/study-sets/" + setId + "/terms", token, List.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authPatch("/api/study-sets/" + setId + "/terms/" + termId, token,
                Map.of("term", "x", "definition", "y"), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    private Integer createSet(String token, String title) {
        ResponseEntity<Map> response = authPost(
                "/api/study-sets", token, Map.of("title", title, "description", "desc"), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return (Integer) response.getBody().get("id");
    }

    private Integer createTerm(String token, Integer setId, String term, String definition) {
        ResponseEntity<Map> response = authPost("/api/study-sets/" + setId + "/terms", token,
                Map.of("term", term, "definition", definition), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return (Integer) response.getBody().get("id");
    }
}
