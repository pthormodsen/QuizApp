package no.patreek.quiz.dto.quiz;

import jakarta.validation.constraints.Size;

public record UpdateAnswerOptionRequest(
        @Size(max = 300, message = "Answer text must be at most 300 characters")
        String text,
        Boolean correct
) {
}
