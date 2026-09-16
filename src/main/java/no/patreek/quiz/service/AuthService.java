package no.patreek.quiz.service;

import no.patreek.quiz.dto.auth.AuthResponse;
import no.patreek.quiz.dto.auth.LoginRequest;
import no.patreek.quiz.dto.auth.RegisterRequest;
import no.patreek.quiz.model.User;
import no.patreek.quiz.repository.UserRepository;
import no.patreek.quiz.security.JwtService;
import org.springframework.dao.DataIntegrityViolationException;
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
        String email = normalizeEmail(request.email());

        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyTakenException();
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));

        try {
            user = userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            // Another request registered the same email between our check and this save.
            throw new EmailAlreadyTakenException();
        }

        String token = jwtService.generateToken(user);
        return new AuthResponse(user.getId(), user.getEmail(), token);
    }

    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmail(email).orElse(null);

        if (user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        String token = jwtService.generateToken(user);
        return new AuthResponse(user.getId(), user.getEmail(), token);
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    public static class EmailAlreadyTakenException extends RuntimeException {
    }

    public static class InvalidCredentialsException extends RuntimeException {
    }
}
