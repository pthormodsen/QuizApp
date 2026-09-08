package no.patreek.quiz.service;

import java.util.List;
import no.patreek.quiz.dto.quiz.CreateQuizRequest;
import no.patreek.quiz.dto.quiz.QuizResponse;
import no.patreek.quiz.model.Quiz;
import no.patreek.quiz.model.User;
import no.patreek.quiz.repository.QuizRepository;
import no.patreek.quiz.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class QuizService {

    private final QuizRepository quizRepository;
    private final UserRepository userRepository;

    public QuizService(QuizRepository quizRepository, UserRepository userRepository) {
        this.quizRepository = quizRepository;
        this.userRepository = userRepository;
    }

    public QuizResponse createQuiz(CreateQuizRequest request, Long ownerId) {
        User owner = userRepository.findById(ownerId).orElseThrow();

        Quiz quiz = new Quiz();
        quiz.setTitle(request.title());
        quiz.setDescription(request.description());
        quiz.setOwner(owner);
        quiz = quizRepository.save(quiz);

        return toResponse(quiz);
    }

    public List<QuizResponse> getQuizzes(Long ownerId) {
        return quizRepository.findByOwnerId(ownerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public QuizResponse getQuiz(Long quizId, Long ownerId) {
        Quiz quiz = quizRepository.findByIdAndOwnerId(quizId, ownerId).orElse(null);

        if (quiz == null) {
            return null;
        }

        return toResponse(quiz);
    }

    private QuizResponse toResponse(Quiz quiz) {
        return new QuizResponse(
                quiz.getId(),
                quiz.getTitle(),
                quiz.getDescription()
        );
    }
}
