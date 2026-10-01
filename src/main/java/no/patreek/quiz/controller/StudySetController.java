package no.patreek.quiz.controller;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import no.patreek.quiz.dto.studyset.CreateStudySetRequest;
import no.patreek.quiz.dto.studyset.StudySetResponse;
import no.patreek.quiz.dto.studyset.UpdateStudySetRequest;
import no.patreek.quiz.model.User;
import no.patreek.quiz.service.StudySetService;
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
@RequestMapping("/api/study-sets")
public class StudySetController {

    private final StudySetService studySetService;

    public StudySetController(StudySetService studySetService) {
        this.studySetService = studySetService;
    }

    @PostMapping
    public ResponseEntity<StudySetResponse> createStudySet(
            @Valid @RequestBody CreateStudySetRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        StudySetResponse response = studySetService.createStudySet(request, currentUser.getId());
        return ResponseEntity.created(URI.create("/api/study-sets/" + response.id())).body(response);
    }

    @GetMapping
    public List<StudySetResponse> getStudySets(@AuthenticationPrincipal User currentUser) {
        return studySetService.getStudySets(currentUser.getId());
    }

    @GetMapping("/{studySetId}")
    public ResponseEntity<StudySetResponse> getStudySet(
            @PathVariable Long studySetId,
            @AuthenticationPrincipal User currentUser
    ) {
        StudySetResponse response = studySetService.getStudySet(studySetId, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{studySetId}")
    public ResponseEntity<StudySetResponse> updateStudySet(
            @PathVariable Long studySetId,
            @Valid @RequestBody UpdateStudySetRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        StudySetResponse response = studySetService.updateStudySet(studySetId, request, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{studySetId}")
    public ResponseEntity<Void> deleteStudySet(
            @PathVariable Long studySetId,
            @AuthenticationPrincipal User currentUser
    ) {
        boolean deleted = studySetService.deleteStudySet(studySetId, currentUser.getId());

        if (!deleted) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.noContent().build();
    }
}
