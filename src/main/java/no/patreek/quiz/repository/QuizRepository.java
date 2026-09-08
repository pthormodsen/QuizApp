package no.patreek.quiz.repository;

import java.util.List;
import java.util.Optional;
import no.patreek.quiz.model.Quiz;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuizRepository extends JpaRepository<Quiz, Long> {
    List<Quiz> findByOwnerId(Long ownerId);

    Optional<Quiz> findByIdAndOwnerId(Long id, Long ownerId);
}
