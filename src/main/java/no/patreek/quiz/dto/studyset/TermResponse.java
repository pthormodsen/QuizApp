package no.patreek.quiz.dto.studyset;

public record TermResponse(
        Long id,
        String term,
        String definition,
        int orderIndex
) {
}
