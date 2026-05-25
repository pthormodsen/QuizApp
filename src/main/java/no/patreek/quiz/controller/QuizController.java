package no.patreek.quiz.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class QuizController {

    @GetMapping("api/quiz")
    public String quiz() {
        return "index.html";
    }

}
