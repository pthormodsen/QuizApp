package no.patreek.quiz.dto.studyset;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record ReorderTermsRequest(
        @NotEmpty(message = "termIds must not be empty")
        List<Long> termIds
) {
}
