package no.patreek.quiz.service;

import java.util.List;
import no.patreek.quiz.dto.quiz.CreateQuizRequest;
import no.patreek.quiz.dto.quiz.QuizResponse;
import no.patreek.quiz.model.Quiz;
import no.patreek.quiz.repository.QuizRepository;
import org.springframework.stereotype.Service;

@Service
public class QuizService {

    private final QuizRepository quizRepository;

    public QuizService(QuizRepository quizRepository) {
        this.quizRepository = quizRepository;
    }

    public QuizResponse createQuiz(CreateQuizRequest request) {
        Quiz quiz = new Quiz();
        quiz.setTitle(request.title());
        quiz.setDescription(request.description());
        quiz = quizRepository.save(quiz);

        return new QuizResponse(
                quiz.getId(),
                quiz.getTitle(),
                quiz.getDescription()
        );
    }

    public List<Quiz> getQuizzes() {
        return quizRepository.findAll();
    }

    public QuizResponse getQuiz(Long quizId) {
        Quiz quiz = quizRepository.findById(quizId).orElse(null);

        if (quiz == null) {
            return null;
        }

        return new QuizResponse(
                quiz.getId(),
                quiz.getTitle(),
                quiz.getDescription()
        );
    }
}
