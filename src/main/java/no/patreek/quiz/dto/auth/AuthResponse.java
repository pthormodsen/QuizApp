package no.patreek.quiz.dto.auth;

public record AuthResponse(
        Long userId,
        String email,
        String token
) {
}
