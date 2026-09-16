package no.patreek.quiz.dto.quiz;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record ReorderQuestionsRequest(
        @NotEmpty(message = "questionIds must not be empty")
        List<Long> questionIds
) {
}
