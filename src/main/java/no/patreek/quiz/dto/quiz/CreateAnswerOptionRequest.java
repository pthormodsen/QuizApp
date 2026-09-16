package no.patreek.quiz.dto.quiz;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateAnswerOptionRequest(
        @NotBlank(message = "Answer text is required")
        @Size(max = 300, message = "Answer text must be at most 300 characters")
        String text,
        boolean correct
) {
}
