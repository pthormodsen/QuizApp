package no.patreek.quiz.dto.studyset;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTermRequest(
        @NotBlank(message = "Term is required")
        @Size(max = 500, message = "Term must be at most 500 characters")
        String term,

        @NotBlank(message = "Definition is required")
        @Size(max = 1000, message = "Definition must be at most 1000 characters")
        String definition
) {
}
