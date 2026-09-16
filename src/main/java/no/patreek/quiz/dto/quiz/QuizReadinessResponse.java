package no.patreek.quiz.dto.quiz;

import java.util.List;

public record QuizReadinessResponse(
        boolean ready,
        List<String> issues
) {
}
