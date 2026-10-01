package no.patreek.quiz.dto.studyset;

import java.time.Instant;

public record StudySetResponse(
        Long id,
        String title,
        String description,
        long termCount,
        Instant createdAt,
        Instant updatedAt
) {
}
