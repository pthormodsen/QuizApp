package no.patreek.quiz.controller;

import java.net.URI;
import no.patreek.quiz.dto.quiz.CreateQuestionRequest;
import no.patreek.quiz.dto.quiz.QuestionResponse;
import no.patreek.quiz.service.QuestionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174"})
@RequestMapping("/api/quizzes/{quizId}/questions")
public class QuestionController {

    private final QuestionService questionService;

    public QuestionController(QuestionService questionService) {
        this.questionService = questionService;
    }

    @PostMapping
    public ResponseEntity<QuestionResponse> createQuestion(
            @PathVariable Long quizId,
            @RequestBody CreateQuestionRequest request
    ) {
        QuestionResponse response = questionService.createQuestion(quizId, request);

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity
                .created(URI.create("/api/quizzes/" + quizId + "/questions/" + response.id()))
                .body(response);
    }
}
