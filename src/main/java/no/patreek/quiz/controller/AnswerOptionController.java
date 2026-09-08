package no.patreek.quiz.controller;

import java.net.URI;
import java.util.List;
import no.patreek.quiz.dto.quiz.AnswerOptionResponse;
import no.patreek.quiz.dto.quiz.CreateAnswerOptionRequest;
import no.patreek.quiz.dto.quiz.UpdateAnswerOptionRequest;
import no.patreek.quiz.model.User;
import no.patreek.quiz.service.AnswerOptionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/questions/{questionId}/answers")
public class AnswerOptionController {

    private final AnswerOptionService answerOptionService;

    public AnswerOptionController(AnswerOptionService answerOptionService) {
        this.answerOptionService = answerOptionService;
    }

    @PostMapping
    public ResponseEntity<AnswerOptionResponse> createAnswerOption(
            @PathVariable Long questionId,
            @RequestBody CreateAnswerOptionRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        AnswerOptionResponse response = answerOptionService.createAnswerOption(questionId, request, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity
                .created(URI.create("/api/questions/" + questionId + "/answers/" + response.id()))
                .body(response);
    }

    @GetMapping
    public ResponseEntity<List<AnswerOptionResponse>> getAnswerOptionsForQuestion(
            @PathVariable Long questionId,
            @AuthenticationPrincipal User currentUser
    ) {
        List<AnswerOptionResponse> responses = answerOptionService.getAnswerOptionsForQuestion(questionId, currentUser.getId());

        if (responses == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(responses);
    }

    @PatchMapping("/{answerId}")
    public ResponseEntity<AnswerOptionResponse> updateAnswerOption(
            @PathVariable Long questionId,
            @PathVariable Long answerId,
            @RequestBody UpdateAnswerOptionRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        AnswerOptionResponse response = answerOptionService.updateAnswerOption(questionId, answerId, request, currentUser.getId());

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(response);
    }
}
