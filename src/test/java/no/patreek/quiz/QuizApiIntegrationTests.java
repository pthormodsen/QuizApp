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
 * End-to-end regression coverage for validation, ownership isolation, single-answer
 * exclusivity, quiz readiness, and question reordering, run against a real HTTP
 * server backed by an in-memory H2 database (see src/test/resources/application.properties).
 */
@SuppressWarnings("unchecked")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class QuizApiIntegrationTests {

    @Autowired
    private TestRestTemplate restTemplate;

    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.com";
    }

    private ResponseEntity<Map> register(String email, String password) {
        return restTemplate.postForEntity(
                "/api/auth/register",
                Map.of("email", email, "password", password),
                Map.class
        );
    }

    private String registerAndGetToken(String email, String password) {
        ResponseEntity<Map> response = register(email, password);
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

    // ---- Validation ----

    @Test
    void register_withInvalidEmail_returns400WithFieldError() {
        ResponseEntity<Map> response = register("not-an-email", "validPass1");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        Map<String, Object> fieldErrors = (Map<String, Object>) response.getBody().get("fieldErrors");
        assertThat(fieldErrors).containsKey("email");
    }

    @Test
    void register_withWeakPassword_returns400WithFieldError() {
        ResponseEntity<Map> response = register(uniqueEmail("weakpw"), "short");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        Map<String, Object> fieldErrors = (Map<String, Object>) response.getBody().get("fieldErrors");
        assertThat(fieldErrors).containsKey("password");
    }

    @Test
    void register_duplicateEmail_returns409() {
        String email = uniqueEmail("dupe");
        assertThat(register(email, "validPass1").getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ResponseEntity<Map> second = register(email, "anotherPass2");
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void login_withWrongPassword_returns401() {
        String email = uniqueEmail("wrongpw");
        registerAndGetToken(email, "validPass1");

        ResponseEntity<Map> response = restTemplate.postForEntity(
                "/api/auth/login",
                Map.of("email", email, "password", "totallyWrong1"),
                Map.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void emailIsNormalized_loginIsCaseInsensitiveAndTrimmed() {
        String rawEmail = "  MixedCase-" + UUID.randomUUID() + "@Example.COM  ";
        registerAndGetToken(rawEmail, "validPass1");

        ResponseEntity<Map> response = restTemplate.postForEntity(
                "/api/auth/login",
                Map.of("email", rawEmail.trim().toLowerCase(), "password", "validPass1"),
                Map.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("email")).isEqualTo(rawEmail.trim().toLowerCase());
    }

    @Test
    void createQuiz_blankTitle_returns400() {
        String token = registerAndGetToken(uniqueEmail("blanktitle"), "validPass1");

        ResponseEntity<Map> response = authPost(
                "/api/quizzes", token, Map.of("title", "  ", "description", "desc"), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ---- Ownership isolation ----

    @Test
    void quiz_isNotVisibleOrEditableByAnotherUser() {
        String ownerToken = registerAndGetToken(uniqueEmail("owner"), "validPass1");
        String otherToken = registerAndGetToken(uniqueEmail("intruder"), "validPass1");

        ResponseEntity<Map> created = authPost(
                "/api/quizzes", ownerToken, Map.of("title", "Owner Quiz", "description", "desc"), Map.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Integer quizId = (Integer) created.getBody().get("id");

        assertThat(authGet("/api/quizzes/" + quizId, otherToken, Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authPatch("/api/quizzes/" + quizId, otherToken,
                Map.of("title", "Hijacked", "description", "desc"), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authDelete("/api/quizzes/" + quizId, otherToken, Void.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);

        assertThat(authGet("/api/quizzes/" + quizId, ownerToken, Map.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    void question_isNotCreatableOrVisibleForAnotherUsersQuiz() {
        String ownerToken = registerAndGetToken(uniqueEmail("qowner"), "validPass1");
        String otherToken = registerAndGetToken(uniqueEmail("qintruder"), "validPass1");

        Map<String, Object> quiz = authPost(
                "/api/quizzes", ownerToken, Map.of("title", "Q Owner Quiz", "description", "desc"), Map.class)
                .getBody();
        Integer quizId = (Integer) quiz.get("id");

        assertThat(authPost("/api/quizzes/" + quizId + "/questions", otherToken,
                Map.of("text", "Sneaky question"), Map.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(authGet("/api/quizzes/" + quizId + "/questions", otherToken, List.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ---- Single-answer exclusivity ----

    @Test
    void markingAnAnswerCorrect_clearsPreviouslyCorrectSibling() {
        String token = registerAndGetToken(uniqueEmail("exclusive"), "validPass1");
        Integer quizId = createQuiz(token, "Exclusivity Quiz");
        Integer questionId = createQuestion(token, quizId, "Pick one");

        Map<String, Object> answerA = authPost(
                "/api/questions/" + questionId + "/answers", token,
                Map.of("text", "A", "correct", true), Map.class).getBody();
        Integer answerAId = (Integer) answerA.get("id");

        Map<String, Object> answerB = authPost(
                "/api/questions/" + questionId + "/answers", token,
                Map.of("text", "B", "correct", true), Map.class).getBody();
        Integer answerBId = (Integer) answerB.get("id");

        ResponseEntity<List> listResponse = authGet(
                "/api/questions/" + questionId + "/answers", token, List.class);
        List<Map<String, Object>> options = listResponse.getBody();

        long correctCount = options.stream().filter(o -> Boolean.TRUE.equals(o.get("correct"))).count();
        assertThat(correctCount).isEqualTo(1);

        Map<String, Object> stillCorrect = options.stream()
                .filter(o -> Boolean.TRUE.equals(o.get("correct")))
                .findFirst().orElseThrow();
        assertThat(stillCorrect.get("id")).isEqualTo(answerBId);

        // Marking A correct again should flip exclusivity back.
        authPatch("/api/questions/" + questionId + "/answers/" + answerAId, token,
                Map.of("correct", true), Map.class);

        List<Map<String, Object>> afterSecondToggle = authGet(
                "/api/questions/" + questionId + "/answers", token, List.class).getBody();
        assertThat(afterSecondToggle.stream().filter(o -> Boolean.TRUE.equals(o.get("correct"))).count())
                .isEqualTo(1);
        assertThat(afterSecondToggle.stream()
                .filter(o -> Boolean.TRUE.equals(o.get("correct")))
                .findFirst().orElseThrow().get("id")).isEqualTo(answerAId);
    }

    @Test
    void updateAnswerOption_blankText_returns400() {
        String token = registerAndGetToken(uniqueEmail("blankanswer"), "validPass1");
        Integer quizId = createQuiz(token, "Blank Answer Quiz");
        Integer questionId = createQuestion(token, quizId, "Question");
        Map<String, Object> answer = authPost(
                "/api/questions/" + questionId + "/answers", token,
                Map.of("text", "Original", "correct", false), Map.class).getBody();
        Integer answerId = (Integer) answer.get("id");

        ResponseEntity<Map> response = authPatch(
                "/api/questions/" + questionId + "/answers/" + answerId, token,
                Map.of("text", "   "), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ---- Quiz readiness ----

    @Test
    void quizReadiness_reflectsMissingOptionsAndMissingCorrectAnswer() {
        String token = registerAndGetToken(uniqueEmail("readiness"), "validPass1");
        Integer quizId = createQuiz(token, "Readiness Quiz");

        Map<String, Object> noQuestions = authGet(
                "/api/quizzes/" + quizId + "/readiness", token, Map.class).getBody();
        assertThat(noQuestions.get("ready")).isEqualTo(false);

        Integer questionId = createQuestion(token, quizId, "Only question");

        Map<String, Object> noOptions = authGet(
                "/api/quizzes/" + quizId + "/readiness", token, Map.class).getBody();
        assertThat(noOptions.get("ready")).isEqualTo(false);

        Integer optionAId = (Integer) authPost(
                "/api/questions/" + questionId + "/answers", token,
                Map.of("text", "Option A", "correct", false), Map.class).getBody().get("id");

        Map<String, Object> oneOption = authGet(
                "/api/quizzes/" + quizId + "/readiness", token, Map.class).getBody();
        assertThat(oneOption.get("ready")).isEqualTo(false);

        authPost("/api/questions/" + questionId + "/answers", token,
                Map.of("text", "Option B", "correct", false), Map.class);

        Map<String, Object> noCorrectAnswer = authGet(
                "/api/quizzes/" + quizId + "/readiness", token, Map.class).getBody();
        assertThat(noCorrectAnswer.get("ready")).isEqualTo(false);

        authPatch("/api/questions/" + questionId + "/answers/" + optionAId, token,
                Map.of("correct", true), Map.class);

        Map<String, Object> ready = authGet(
                "/api/quizzes/" + quizId + "/readiness", token, Map.class).getBody();
        assertThat(ready.get("ready")).isEqualTo(true);
        assertThat((List<?>) ready.get("issues")).isEmpty();
    }

    // ---- Question reordering ----

    @Test
    void reorderQuestions_persistsNewOrderAndRejectsMismatchedIds() {
        String token = registerAndGetToken(uniqueEmail("reorder"), "validPass1");
        Integer quizId = createQuiz(token, "Reorder Quiz");

        Integer q1 = createQuestion(token, quizId, "Q1");
        Integer q2 = createQuestion(token, quizId, "Q2");
        Integer q3 = createQuestion(token, quizId, "Q3");

        ResponseEntity<List> reorderResponse = authPatch(
                "/api/quizzes/" + quizId + "/questions/reorder", token,
                Map.of("questionIds", List.of(q3, q1, q2)), List.class);
        assertThat(reorderResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        List<Map<String, Object>> reordered = authGet(
                "/api/quizzes/" + quizId + "/questions", token, List.class).getBody();
        assertThat(reordered).extracting(q -> q.get("id"))
                .containsExactly(q3, q1, q2);

        ResponseEntity<Map> badReorder = authPatch(
                "/api/quizzes/" + quizId + "/questions/reorder", token,
                Map.of("questionIds", List.of(q1, q2)), Map.class);
        assertThat(badReorder.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private Integer createQuiz(String token, String title) {
        Map<String, Object> body = authPost(
                "/api/quizzes", token, Map.of("title", title, "description", "desc"), Map.class).getBody();
        return (Integer) body.get("id");
    }

    private Integer createQuestion(String token, Integer quizId, String text) {
        Map<String, Object> body = authPost(
                "/api/quizzes/" + quizId + "/questions", token, Map.of("text", text), Map.class).getBody();
        return (Integer) body.get("id");
    }
}
