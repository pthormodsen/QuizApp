package no.patreek.quiz.service;

import java.util.List;
import no.patreek.quiz.dto.quiz.AnswerOptionResponse;
import no.patreek.quiz.dto.quiz.CreateAnswerOptionRequest;
import no.patreek.quiz.dto.quiz.UpdateAnswerOptionRequest;
import no.patreek.quiz.model.AnswerOption;
import no.patreek.quiz.model.Question;
import no.patreek.quiz.repository.AnswerOptionRepository;
import no.patreek.quiz.repository.QuestionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnswerOptionService {

    private final AnswerOptionRepository answerOptionRepository;
    private final QuestionRepository questionRepository;

    public AnswerOptionService(
            AnswerOptionRepository answerOptionRepository,
            QuestionRepository questionRepository
    ) {
        this.answerOptionRepository = answerOptionRepository;
        this.questionRepository = questionRepository;
    }

    @Transactional
    public AnswerOptionResponse createAnswerOption(Long questionId, CreateAnswerOptionRequest request, Long ownerId) {
        Question question = findOwnedQuestion(questionId, ownerId);

        if (question == null) {
            return null;
        }

        AnswerOption answerOption = new AnswerOption();
        answerOption.setText(request.text());
        answerOption.setCorrect(request.correct());
        answerOption.setQuestion(question);

        answerOption = answerOptionRepository.save(answerOption);

        return toResponse(answerOption);
    }

    @Transactional
    public AnswerOptionResponse updateAnswerOption(
            Long questionId,
            Long answerId,
            UpdateAnswerOptionRequest request,
            Long ownerId
    ) {
        Question question = findOwnedQuestion(questionId, ownerId);

        if (question == null) {
            return null;
        }

        AnswerOption answerOption = answerOptionRepository.findById(answerId).orElse(null);

        if (answerOption == null || !answerOption.getQuestion().getId().equals(questionId)) {
            return null;
        }

        answerOption.setCorrect(request.correct());
        answerOption = answerOptionRepository.save(answerOption);

        return toResponse(answerOption);
    }

    @Transactional
    public List<AnswerOptionResponse> getAnswerOptionsForQuestion(Long questionId, Long ownerId) {
        Question question = findOwnedQuestion(questionId, ownerId);

        if (question == null) {
            return null;
        }

        return answerOptionRepository.findByQuestionId(questionId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private Question findOwnedQuestion(Long questionId, Long ownerId) {
        Question question = questionRepository.findById(questionId).orElse(null);

        if (question == null || !question.getQuiz().getOwner().getId().equals(ownerId)) {
            return null;
        }

        return question;
    }

    private AnswerOptionResponse toResponse(AnswerOption answerOption) {
        return new AnswerOptionResponse(
                answerOption.getId(),
                answerOption.getText(),
                answerOption.isCorrect()
        );
    }
}
