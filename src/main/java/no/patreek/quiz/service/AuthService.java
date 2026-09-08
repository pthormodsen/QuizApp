package no.patreek.quiz.service;

import no.patreek.quiz.dto.auth.AuthResponse;
import no.patreek.quiz.dto.auth.LoginRequest;
import no.patreek.quiz.dto.auth.RegisterRequest;
import no.patreek.quiz.model.User;
import no.patreek.quiz.repository.UserRepository;
import no.patreek.quiz.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new EmailAlreadyTakenException();
        }

        User user = new User();
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user = userRepository.save(user);

        String token = jwtService.generateToken(user);
        return new AuthResponse(user.getId(), user.getEmail(), token);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email()).orElse(null);

        if (user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        String token = jwtService.generateToken(user);
        return new AuthResponse(user.getId(), user.getEmail(), token);
    }

    public static class EmailAlreadyTakenException extends RuntimeException {
    }

    public static class InvalidCredentialsException extends RuntimeException {
    }
}
