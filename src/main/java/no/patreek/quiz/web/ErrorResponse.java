package no.patreek.quiz.web;

import java.util.Map;

public record ErrorResponse(
        String error,
        Map<String, String> fieldErrors
) {
    public ErrorResponse(String error) {
        this(error, null);
    }
}
