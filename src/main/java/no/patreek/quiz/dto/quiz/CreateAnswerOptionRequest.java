package no.patreek.quiz.dto.quiz;

public record CreateAnswerOptionRequest(
        String text,
        boolean correct
) {
}
