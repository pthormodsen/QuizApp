package no.patreek.quiz.dto.quiz;

public record AnswerOptionResponse(
        Long id,
        String text,
        boolean correct
) {
}
