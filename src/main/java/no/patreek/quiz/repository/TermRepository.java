package no.patreek.quiz.repository;

import java.util.List;
import java.util.Optional;
import no.patreek.quiz.model.Term;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TermRepository extends JpaRepository<Term, Long> {
    List<Term> findByStudySetIdOrderByOrderIndexAscIdAsc(Long studySetId);

    Optional<Term> findByIdAndStudySetIdAndStudySetOwnerId(Long id, Long studySetId, Long ownerId);

    long countByStudySetId(Long studySetId);

    @Query("select coalesce(max(t.orderIndex), -1) from Term t where t.studySet.id = :studySetId")
    int findMaxOrderIndex(@Param("studySetId") Long studySetId);

    void deleteByStudySetId(Long studySetId);
}
