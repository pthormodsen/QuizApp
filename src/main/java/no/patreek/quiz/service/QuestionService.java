package no.patreek.quiz.service;

import java.util.List;
import no.patreek.quiz.dto.quiz.CreateQuestionRequest;
import no.patreek.quiz.dto.quiz.QuestionResponse;
import no.patreek.quiz.model.Question;
import no.patreek.quiz.model.Quiz;
import no.patreek.quiz.repository.QuestionRepository;
import no.patreek.quiz.repository.QuizRepository;
import org.springframework.stereotype.Service;

@Service
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final QuizRepository quizRepository;

    public QuestionService(QuestionRepository questionRepository, QuizRepository quizRepository) {
        this.questionRepository = questionRepository;
        this.quizRepository = quizRepository;
    }

    public QuestionResponse createQuestion(Long quizId, CreateQuestionRequest request) {
        Quiz quiz = quizRepository.findById(quizId).orElse(null);

        if (quiz == null) {
            return null;
        }

        Question question = new Question();
        question.setText(request.text());
        question.setQuiz(quiz);

        question = questionRepository.save(question);

        return new QuestionResponse(
                question.getId(),
                question.getText()
        );
    }

    public List<Question> getQuestions() {
        return questionRepository.findAll();
    }

    public QuestionResponse getQuestion(Long questionId) {
        Question question = questionRepository.findById(questionId).orElse(null);

        if (question == null) {
            return null;
        }

        return new QuestionResponse(
            question.getId(),
            question.getText()
        );
    }

    public List<QuestionResponse> getQuestionsForQuiz(Long quizId) {
        List<Question> questions = questionRepository.findByQuizId(quizId);
        return questions.stream()
                .map(q -> new QuestionResponse(q.getId(), q.getText()))
                .toList();
    }

}
