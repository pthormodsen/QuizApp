package no.patreek.quiz.dto.quiz;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateQuestionRequest(
        @NotBlank(message = "Question text is required")
        @Size(max = 500, message = "Question text must be at most 500 characters")
        String text
) {
}
