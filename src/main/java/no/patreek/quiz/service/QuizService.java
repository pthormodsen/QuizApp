package no.patreek.quiz.service;

import java.util.ArrayList;
import java.util.List;
import no.patreek.quiz.dto.quiz.CreateQuizRequest;
import no.patreek.quiz.dto.quiz.QuizReadinessResponse;
import no.patreek.quiz.dto.quiz.QuizResponse;
import no.patreek.quiz.dto.quiz.UpdateQuizRequest;
import no.patreek.quiz.model.AnswerOption;
import no.patreek.quiz.model.Question;
import no.patreek.quiz.model.Quiz;
import no.patreek.quiz.model.User;
import no.patreek.quiz.repository.AnswerOptionRepository;
import no.patreek.quiz.repository.QuestionRepository;
import no.patreek.quiz.repository.QuizRepository;
import no.patreek.quiz.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuizService {

    private final QuizRepository quizRepository;
    private final UserRepository userRepository;
    private final QuestionRepository questionRepository;
    private final AnswerOptionRepository answerOptionRepository;

    public QuizService(
            QuizRepository quizRepository,
            UserRepository userRepository,
            QuestionRepository questionRepository,
            AnswerOptionRepository answerOptionRepository
    ) {
        this.quizRepository = quizRepository;
        this.userRepository = userRepository;
        this.questionRepository = questionRepository;
        this.answerOptionRepository = answerOptionRepository;
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

    public QuizResponse updateQuiz(Long quizId, UpdateQuizRequest request, Long ownerId) {
        Quiz quiz = quizRepository.findByIdAndOwnerId(quizId, ownerId).orElse(null);

        if (quiz == null) {
            return null;
        }

        quiz.setTitle(request.title());
        quiz.setDescription(request.description());
        quiz = quizRepository.save(quiz);

        return toResponse(quiz);
    }

    @Transactional
    public boolean deleteQuiz(Long quizId, Long ownerId) {
        Quiz quiz = quizRepository.findByIdAndOwnerId(quizId, ownerId).orElse(null);

        if (quiz == null) {
            return false;
        }

        List<Long> questionIds = questionRepository.findByQuizId(quizId)
                .stream()
                .map(Question::getId)
                .toList();

        if (!questionIds.isEmpty()) {
            answerOptionRepository.deleteByQuestionIdIn(questionIds);
        }
        questionRepository.deleteByQuizId(quizId);
        quizRepository.delete(quiz);

        return true;
    }

    @Transactional
    public QuizReadinessResponse checkReadiness(Long quizId, Long ownerId) {
        Quiz quiz = quizRepository.findByIdAndOwnerId(quizId, ownerId).orElse(null);

        if (quiz == null) {
            return null;
        }

        List<Question> questions = questionRepository.findByQuizIdOrdered(quizId);
        List<String> issues = new ArrayList<>();

        if (questions.isEmpty()) {
            issues.add("Add at least one question before starting the quiz.");
        }

        for (Question question : questions) {
            List<AnswerOption> options = answerOptionRepository.findByQuestionId(question.getId());
            long correctCount = options.stream().filter(AnswerOption::isCorrect).count();

            if (options.size() < 2) {
                issues.add("\"" + question.getText() + "\" needs at least two answer options.");
            }
            if (correctCount != 1) {
                issues.add("\"" + question.getText() + "\" must have exactly one correct answer.");
            }
        }

        return new QuizReadinessResponse(issues.isEmpty(), issues);
    }

    private QuizResponse toResponse(Quiz quiz) {
        return new QuizResponse(
                quiz.getId(),
                quiz.getTitle(),
                quiz.getDescription()
        );
    }
}
