package no.patreek.quiz.service;

import java.util.List;
import no.patreek.quiz.dto.quiz.CreateQuestionRequest;
import no.patreek.quiz.dto.quiz.QuestionResponse;
import no.patreek.quiz.dto.quiz.ReorderQuestionsRequest;
import no.patreek.quiz.dto.quiz.UpdateQuestionRequest;
import no.patreek.quiz.model.Question;
import no.patreek.quiz.model.Quiz;
import no.patreek.quiz.repository.AnswerOptionRepository;
import no.patreek.quiz.repository.QuestionRepository;
import no.patreek.quiz.repository.QuizRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final QuizRepository quizRepository;
    private final AnswerOptionRepository answerOptionRepository;

    public QuestionService(
            QuestionRepository questionRepository,
            QuizRepository quizRepository,
            AnswerOptionRepository answerOptionRepository
    ) {
        this.questionRepository = questionRepository;
        this.quizRepository = quizRepository;
        this.answerOptionRepository = answerOptionRepository;
    }

    public QuestionResponse createQuestion(Long quizId, CreateQuestionRequest request, Long ownerId) {
        Quiz quiz = quizRepository.findByIdAndOwnerId(quizId, ownerId).orElse(null);

        if (quiz == null) {
            return null;
        }

        Question question = new Question();
        question.setText(request.text());
        question.setQuiz(quiz);
        question.setOrderIndex((int) questionRepository.countByQuizId(quizId));

        question = questionRepository.save(question);

        return toResponse(question);
    }

    public List<QuestionResponse> getQuestionsForQuiz(Long quizId, Long ownerId) {
        Quiz quiz = quizRepository.findByIdAndOwnerId(quizId, ownerId).orElse(null);

        if (quiz == null) {
            return null;
        }

        List<Question> questions = questionRepository.findByQuizIdOrdered(quizId);
        return questions.stream()
                .map(this::toResponse)
                .toList();
    }

    public QuestionResponse updateQuestion(Long quizId, Long questionId, UpdateQuestionRequest request, Long ownerId) {
        Question question = findOwnedQuestion(quizId, questionId, ownerId);

        if (question == null) {
            return null;
        }

        question.setText(request.text());
        question = questionRepository.save(question);

        return toResponse(question);
    }

    @Transactional
    public boolean deleteQuestion(Long quizId, Long questionId, Long ownerId) {
        Question question = findOwnedQuestion(quizId, questionId, ownerId);

        if (question == null) {
            return false;
        }

        answerOptionRepository.deleteByQuestionIdIn(List.of(questionId));
        questionRepository.delete(question);

        return true;
    }

    @Transactional
    public List<QuestionResponse> reorderQuestions(Long quizId, ReorderQuestionsRequest request, Long ownerId) {
        Quiz quiz = quizRepository.findByIdAndOwnerId(quizId, ownerId).orElse(null);

        if (quiz == null) {
            return null;
        }

        List<Question> questions = questionRepository.findByQuizId(quizId);
        List<Long> requestedIds = request.questionIds();

        boolean sameQuestions = requestedIds != null
                && requestedIds.size() == questions.size()
                && questions.stream().map(Question::getId).allMatch(requestedIds::contains);

        if (!sameQuestions) {
            return null;
        }

        for (Question question : questions) {
            question.setOrderIndex(requestedIds.indexOf(question.getId()));
        }
        questionRepository.saveAll(questions);

        return getQuestionsForQuiz(quizId, ownerId);
    }

    private Question findOwnedQuestion(Long quizId, Long questionId, Long ownerId) {
        Question question = questionRepository.findById(questionId).orElse(null);

        if (question == null
                || !question.getQuiz().getId().equals(quizId)
                || !question.getQuiz().getOwner().getId().equals(ownerId)) {
            return null;
        }

        return question;
    }

    private QuestionResponse toResponse(Question question) {
        return new QuestionResponse(
                question.getId(),
                question.getText()
        );
    }

}
