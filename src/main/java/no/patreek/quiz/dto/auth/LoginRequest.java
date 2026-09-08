package no.patreek.quiz.dto.auth;

public record LoginRequest(
        String email,
        String password
) {
}
