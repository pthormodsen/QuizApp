package no.patreek.quiz.controller;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import no.patreek.quiz.dto.quiz.CreateQuizRequest;
import no.patreek.quiz.dto.quiz.QuizReadinessResponse;
import no.patreek.quiz.dto.quiz.QuizResponse;
import no.patreek.quiz.dto.quiz.UpdateQuizRequest;
import no.patreek.quiz.model.User;
import no.patreek.quiz.service.QuizService;
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
@RequestMapping("/api/quizzes")
public class QuizController {

    private final QuizService quizService;

    public QuizController(QuizService quizService) {
        this.quizService = quizService;
    }

    @PostMapping
    public ResponseEntity<QuizResponse> createQuiz(
            @Valid @RequestBody CreateQuizRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        QuizResponse response = quizService.createQuiz(request, currentUser.getId());
        return ResponseEntity.created(URI.create("/api/quizzes/" + response.id())).body(response);
    }

    @GetMapping
    public List<QuizResponse> getQuizzes(@AuthenticationPrincipal User currentUser) {
        return quizService.getQuizzes(currentUser.getId());
    }

    @GetMapping("/{quizId}")
    public ResponseEntity<QuizResponse> getQuiz(
            @PathVariable Long quizId,
            @AuthenticationPrincipal User currentUser
    ) {
        QuizResponse response = quizService.getQuiz(quizId, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{quizId}")
    public ResponseEntity<QuizResponse> updateQuiz(
            @PathVariable Long quizId,
            @Valid @RequestBody UpdateQuizRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        QuizResponse response = quizService.updateQuiz(quizId, request, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{quizId}")
    public ResponseEntity<Void> deleteQuiz(
            @PathVariable Long quizId,
            @AuthenticationPrincipal User currentUser
    ) {
        boolean deleted = quizService.deleteQuiz(quizId, currentUser.getId());

        if (!deleted) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{quizId}/readiness")
    public ResponseEntity<QuizReadinessResponse> getReadiness(
            @PathVariable Long quizId,
            @AuthenticationPrincipal User currentUser
    ) {
        QuizReadinessResponse response = quizService.checkReadiness(quizId, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(response);
    }
}
