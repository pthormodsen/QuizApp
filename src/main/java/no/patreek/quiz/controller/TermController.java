package no.patreek.quiz.controller;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import no.patreek.quiz.dto.studyset.CreateTermRequest;
import no.patreek.quiz.dto.studyset.ReorderTermsRequest;
import no.patreek.quiz.dto.studyset.TermResponse;
import no.patreek.quiz.dto.studyset.UpdateTermRequest;
import no.patreek.quiz.model.User;
import no.patreek.quiz.service.TermService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/study-sets/{studySetId}/terms")
public class TermController {

    private final TermService termService;

    public TermController(TermService termService) {
        this.termService = termService;
    }

    @PostMapping
    public ResponseEntity<TermResponse> createTerm(
            @PathVariable Long studySetId,
            @Valid @RequestBody CreateTermRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        TermResponse response = termService.createTerm(studySetId, request, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity
                .created(URI.create("/api/study-sets/" + studySetId + "/terms/" + response.id()))
                .body(response);
    }

    @GetMapping
    public ResponseEntity<List<TermResponse>> getTerms(
            @PathVariable Long studySetId,
            @AuthenticationPrincipal User currentUser
    ) {
        List<TermResponse> responses = termService.getTerms(studySetId, currentUser.getId());

        if (responses == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(responses);
    }

    @PatchMapping("/{termId}")
    public ResponseEntity<TermResponse> updateTerm(
            @PathVariable Long studySetId,
            @PathVariable Long termId,
            @Valid @RequestBody UpdateTermRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        TermResponse response = termService.updateTerm(studySetId, termId, request, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{termId}")
    public ResponseEntity<Void> deleteTerm(
            @PathVariable Long studySetId,
            @PathVariable Long termId,
            @AuthenticationPrincipal User currentUser
    ) {
        boolean deleted = termService.deleteTerm(studySetId, termId, currentUser.getId());

        if (!deleted) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/reorder")
    public ResponseEntity<List<TermResponse>> reorderTerms(
            @PathVariable Long studySetId,
            @Valid @RequestBody ReorderTermsRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        List<TermResponse> responses = termService.reorderTerms(studySetId, request, currentUser.getId());

        if (responses == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(responses);
    }
}
