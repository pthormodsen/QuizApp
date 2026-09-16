package no.patreek.quiz.repository;

import java.util.List;
import no.patreek.quiz.model.AnswerOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnswerOptionRepository extends JpaRepository<AnswerOption, Long> {
    List<AnswerOption> findByQuestionId(Long questionId);

    void deleteByQuestionIdIn(List<Long> questionIds);

    @Modifying(clearAutomatically = true)
    @Query("update AnswerOption a set a.correct = false where a.question.id = :questionId and a.id <> :keepId")
    void clearOtherCorrectAnswers(@Param("questionId") Long questionId, @Param("keepId") Long keepId);
}
