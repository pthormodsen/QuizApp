package no.patreek.quiz.controller;

import java.net.URI;
import java.util.List;
import no.patreek.quiz.dto.quiz.CreateQuizRequest;
import no.patreek.quiz.dto.quiz.QuizResponse;
import no.patreek.quiz.model.Quiz;
import no.patreek.quiz.service.QuizService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
@RequestMapping("/api/quizzes")
public class QuizController {

    private final QuizService quizService;

    public QuizController(QuizService quizService) {
        this.quizService = quizService;
    }

    @PostMapping
    public ResponseEntity<QuizResponse> createQuiz(@RequestBody CreateQuizRequest request) {
        QuizResponse response = quizService.createQuiz(request);
        if (response == null) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        return ResponseEntity.created(URI.create("/api/quizzes/" + response.id())).body(response);
    }

    @GetMapping
    public List<Quiz> getQuizzes() {
        return quizService.getQuizzes();
    }

    @GetMapping("/{quizId}")
    public QuizResponse getQuiz(@PathVariable Long quizId) {
        return quizService.getQuiz(quizId);
    }
}
