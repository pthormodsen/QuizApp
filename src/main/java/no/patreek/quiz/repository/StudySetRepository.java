package no.patreek.quiz.repository;

import java.util.List;
import java.util.Optional;
import no.patreek.quiz.model.StudySet;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudySetRepository extends JpaRepository<StudySet, Long> {
    List<StudySet> findByOwnerIdOrderByUpdatedAtDescIdDesc(Long ownerId);

    Optional<StudySet> findByIdAndOwnerId(Long id, Long ownerId);
}
