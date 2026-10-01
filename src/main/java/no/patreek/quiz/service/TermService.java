package no.patreek.quiz.service;

import java.util.HashSet;
import java.util.List;
import no.patreek.quiz.dto.studyset.CreateTermRequest;
import no.patreek.quiz.dto.studyset.ReorderTermsRequest;
import no.patreek.quiz.dto.studyset.TermResponse;
import no.patreek.quiz.dto.studyset.UpdateTermRequest;
import no.patreek.quiz.model.StudySet;
import no.patreek.quiz.model.Term;
import no.patreek.quiz.repository.StudySetRepository;
import no.patreek.quiz.repository.TermRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TermService {

    private final TermRepository termRepository;
    private final StudySetRepository studySetRepository;

    public TermService(TermRepository termRepository, StudySetRepository studySetRepository) {
        this.termRepository = termRepository;
        this.studySetRepository = studySetRepository;
    }

    @Transactional
    public TermResponse createTerm(Long studySetId, CreateTermRequest request, Long ownerId) {
        StudySet studySet = studySetRepository.findByIdAndOwnerId(studySetId, ownerId).orElse(null);

        if (studySet == null) {
            return null;
        }

        Term term = new Term();
        term.setTerm(request.term().trim());
        term.setDefinition(request.definition().trim());
        term.setStudySet(studySet);
        // max + 1 rather than count, so positions never collide after deletions.
        term.setOrderIndex(termRepository.findMaxOrderIndex(studySetId) + 1);
        term = termRepository.save(term);
        studySet.touch();

        return toResponse(term);
    }

    public List<TermResponse> getTerms(Long studySetId, Long ownerId) {
        StudySet studySet = studySetRepository.findByIdAndOwnerId(studySetId, ownerId).orElse(null);

        if (studySet == null) {
            return null;
        }

        return termRepository.findByStudySetIdOrderByOrderIndexAscIdAsc(studySetId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TermResponse updateTerm(Long studySetId, Long termId, UpdateTermRequest request, Long ownerId) {
        Term term = termRepository.findByIdAndStudySetIdAndStudySetOwnerId(termId, studySetId, ownerId).orElse(null);

        if (term == null) {
            return null;
        }

        term.setTerm(request.term().trim());
        term.setDefinition(request.definition().trim());
        term = termRepository.save(term);
        term.getStudySet().touch();

        return toResponse(term);
    }

    @Transactional
    public boolean deleteTerm(Long studySetId, Long termId, Long ownerId) {
        Term term = termRepository.findByIdAndStudySetIdAndStudySetOwnerId(termId, studySetId, ownerId).orElse(null);

        if (term == null) {
            return false;
        }

        term.getStudySet().touch();
        termRepository.delete(term);

        return true;
    }

    /**
     * Returns null when the set is missing or not owned (404); throws IllegalArgumentException
     * when the ids don't match the set's terms exactly (400).
     */
    @Transactional
    public List<TermResponse> reorderTerms(Long studySetId, ReorderTermsRequest request, Long ownerId) {
        StudySet studySet = studySetRepository.findByIdAndOwnerId(studySetId, ownerId).orElse(null);

        if (studySet == null) {
            return null;
        }

        List<Term> terms = termRepository.findByStudySetIdOrderByOrderIndexAscIdAsc(studySetId);
        List<Long> requestedIds = request.termIds();

        boolean sameTerms = requestedIds.size() == terms.size()
                && new HashSet<>(requestedIds).size() == requestedIds.size()
                && terms.stream().map(Term::getId).allMatch(requestedIds::contains);

        if (!sameTerms) {
            throw new IllegalArgumentException("termIds must contain each term in the set exactly once");
        }

        for (Term term : terms) {
            term.setOrderIndex(requestedIds.indexOf(term.getId()));
        }
        termRepository.saveAll(terms);
        studySet.touch();

        return terms.stream()
                .sorted((a, b) -> Integer.compare(a.getOrderIndex(), b.getOrderIndex()))
                .map(this::toResponse)
                .toList();
    }

    private TermResponse toResponse(Term term) {
        return new TermResponse(
                term.getId(),
                term.getTerm(),
                term.getDefinition(),
                term.getOrderIndex()
        );
    }
}
