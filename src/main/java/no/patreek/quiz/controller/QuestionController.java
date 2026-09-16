package no.patreek.quiz.controller;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;

import no.patreek.quiz.dto.quiz.CreateQuestionRequest;
import no.patreek.quiz.dto.quiz.QuestionResponse;
import no.patreek.quiz.dto.quiz.ReorderQuestionsRequest;
import no.patreek.quiz.dto.quiz.UpdateQuestionRequest;
import no.patreek.quiz.model.User;
import no.patreek.quiz.service.QuestionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/quizzes/{quizId}/questions")
public class QuestionController {

    private final QuestionService questionService;

    public QuestionController(QuestionService questionService) {
        this.questionService = questionService;
    }

    @PostMapping
    public ResponseEntity<QuestionResponse> createQuestion(
            @PathVariable Long quizId,
            @Valid @RequestBody CreateQuestionRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        QuestionResponse response = questionService.createQuestion(quizId, request, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity
                .created(URI.create("/api/quizzes/" + quizId + "/questions/" + response.id()))
                .body(response);
    }

    @GetMapping
    public ResponseEntity<List<QuestionResponse>> getQuestionsForQuiz(
            @PathVariable Long quizId,
            @AuthenticationPrincipal User currentUser
    ) {
        List<QuestionResponse> responses = questionService.getQuestionsForQuiz(quizId, currentUser.getId());

        if (responses == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(responses);
    }

    @PatchMapping("/{questionId}")
    public ResponseEntity<QuestionResponse> updateQuestion(
            @PathVariable Long quizId,
            @PathVariable Long questionId,
            @Valid @RequestBody UpdateQuestionRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        QuestionResponse response = questionService.updateQuestion(quizId, questionId, request, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{questionId}")
    public ResponseEntity<Void> deleteQuestion(
            @PathVariable Long quizId,
            @PathVariable Long questionId,
            @AuthenticationPrincipal User currentUser
    ) {
        boolean deleted = questionService.deleteQuestion(quizId, questionId, currentUser.getId());

        if (!deleted) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/reorder")
    public ResponseEntity<List<QuestionResponse>> reorderQuestions(
            @PathVariable Long quizId,
            @Valid @RequestBody ReorderQuestionsRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        List<QuestionResponse> responses = questionService.reorderQuestions(quizId, request, currentUser.getId());

        if (responses == null) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(responses);
    }
}
