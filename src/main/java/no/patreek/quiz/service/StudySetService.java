package no.patreek.quiz.service;

import java.util.List;
import no.patreek.quiz.dto.studyset.CreateStudySetRequest;
import no.patreek.quiz.dto.studyset.StudySetResponse;
import no.patreek.quiz.dto.studyset.UpdateStudySetRequest;
import no.patreek.quiz.model.StudySet;
import no.patreek.quiz.model.User;
import no.patreek.quiz.repository.StudySetRepository;
import no.patreek.quiz.repository.TermRepository;
import no.patreek.quiz.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudySetService {

    private final StudySetRepository studySetRepository;
    private final TermRepository termRepository;
    private final UserRepository userRepository;

    public StudySetService(
            StudySetRepository studySetRepository,
            TermRepository termRepository,
            UserRepository userRepository
    ) {
        this.studySetRepository = studySetRepository;
        this.termRepository = termRepository;
        this.userRepository = userRepository;
    }

    public StudySetResponse createStudySet(CreateStudySetRequest request, Long ownerId) {
        User owner = userRepository.findById(ownerId).orElseThrow();

        StudySet studySet = new StudySet();
        studySet.setTitle(request.title().trim());
        studySet.setDescription(normalizeDescription(request.description()));
        studySet.setOwner(owner);
        studySet = studySetRepository.save(studySet);

        return toResponse(studySet);
    }

    public List<StudySetResponse> getStudySets(Long ownerId) {
        return studySetRepository.findByOwnerIdOrderByUpdatedAtDescIdDesc(ownerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public StudySetResponse getStudySet(Long studySetId, Long ownerId) {
        StudySet studySet = studySetRepository.findByIdAndOwnerId(studySetId, ownerId).orElse(null);

        if (studySet == null) {
            return null;
        }

        return toResponse(studySet);
    }

    public StudySetResponse updateStudySet(Long studySetId, UpdateStudySetRequest request, Long ownerId) {
        StudySet studySet = studySetRepository.findByIdAndOwnerId(studySetId, ownerId).orElse(null);

        if (studySet == null) {
            return null;
        }

        studySet.setTitle(request.title().trim());
        studySet.setDescription(normalizeDescription(request.description()));
        studySet = studySetRepository.save(studySet);

        return toResponse(studySet);
    }

    @Transactional
    public boolean deleteStudySet(Long studySetId, Long ownerId) {
        StudySet studySet = studySetRepository.findByIdAndOwnerId(studySetId, ownerId).orElse(null);

        if (studySet == null) {
            return false;
        }

        termRepository.deleteByStudySetId(studySetId);
        studySetRepository.delete(studySet);

        return true;
    }

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        return description.trim();
    }

    private StudySetResponse toResponse(StudySet studySet) {
        return new StudySetResponse(
                studySet.getId(),
                studySet.getTitle(),
                studySet.getDescription(),
                termRepository.countByStudySetId(studySet.getId()),
                studySet.getCreatedAt(),
                studySet.getUpdatedAt()
        );
    }
}
