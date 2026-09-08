package no.patreek.quiz.dto.auth;

public record RegisterRequest(
        String email,
        String password
) {
}
