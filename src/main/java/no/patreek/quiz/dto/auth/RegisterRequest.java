package no.patreek.quiz.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record RegisterRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Must be a valid email address")
        String email,

        @NotBlank(message = "Password is required")
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,72}$",
                message = "Password must be 8-72 characters and include at least one letter and one number"
        )
        String password
) {
    public RegisterRequest {
        email = email == null ? null : email.trim();
    }
}
