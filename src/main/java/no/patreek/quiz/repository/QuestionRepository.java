package no.patreek.quiz.repository;

import no.patreek.quiz.model.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByQuizId(Long quizId);

    @Query("select q from Question q where q.quiz.id = :quizId order by q.orderIndex nulls last, q.id asc")
    List<Question> findByQuizIdOrdered(@Param("quizId") Long quizId);

    long countByQuizId(Long quizId);

    void deleteByQuizId(Long quizId);
}
