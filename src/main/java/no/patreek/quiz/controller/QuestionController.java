package no.patreek.quiz.controller;

import java.net.URI;
import java.util.List;

import no.patreek.quiz.dto.quiz.CreateQuestionRequest;
import no.patreek.quiz.dto.quiz.QuestionResponse;
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
            @RequestBody CreateQuestionRequest request,
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
}
