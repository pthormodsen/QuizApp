import { describe, it, expect } from "vitest";
import type { Term } from "../../api/types";
import {
  buildMultipleChoiceQuestions,
  canBuildMultipleChoice,
  isCorrectAnswer,
  normalizeAnswer,
  parseStudyMode,
  seededRandom,
  shuffle,
} from "./studyUtils";

const term = (id: number, termText: string, definition: string): Term => ({
  id,
  term: termText,
  definition,
  orderIndex: id,
});

const sixTerms = [
  term(1, "hola", "hello"),
  term(2, "adiós", "goodbye"),
  term(3, "gracias", "thank you"),
  term(4, "por favor", "please"),
  term(5, "sí", "yes"),
  term(6, "no", "no"),
];

describe("normalizeAnswer / isCorrectAnswer", () => {
  it("ignores surrounding whitespace, case and repeated whitespace", () => {
    expect(normalizeAnswer("  Thank\t  YOU \n")).toBe("thank you");
    expect(isCorrectAnswer(" thank   you ", "Thank you")).toBe(true);
    expect(isCorrectAnswer("THANK YOU", "thank\nyou")).toBe(true);
  });

  it("does not do fuzzy matching", () => {
    expect(isCorrectAnswer("thank you!", "thank you")).toBe(false);
    expect(isCorrectAnswer("thanks", "thank you")).toBe(false);
    expect(isCorrectAnswer("", "thank you")).toBe(false);
  });
});

describe("shuffle", () => {
  it("returns a reproducible permutation without changing the input", () => {
    const items = [1, 2, 3, 4, 5];
    const first = shuffle(items, seededRandom(42));
    expect(shuffle(items, seededRandom(42))).toEqual(first);
    expect([...first].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("parseStudyMode", () => {
  it("accepts only known modes", () => {
    expect(parseStudyMode("flashcards")).toBe("flashcards");
    expect(parseStudyMode("multiple-choice")).toBe("multiple-choice");
    expect(parseStudyMode("written")).toBe("written");
    expect(parseStudyMode("learn")).toBeNull();
    expect(parseStudyMode(null)).toBeNull();
  });
});

describe("buildMultipleChoiceQuestions", () => {
  it("asks every term once, with four distinct choices including the right definition", () => {
    const questions = buildMultipleChoiceQuestions(sixTerms, seededRandom(1));

    expect(questions.map((q) => q.termId).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const question of questions) {
      const source = sixTerms.find((t) => t.id === question.termId)!;
      expect(question.prompt).toBe(source.term);
      expect(question.choices).toHaveLength(4);
      expect(new Set(question.choices).size).toBe(4);
      expect(question.choices[question.correctIndex]).toBe(source.definition);
      expect(question.answer).toBe(source.definition);
    }
  });

  it("is deterministic for the same random source", () => {
    expect(buildMultipleChoiceQuestions(sixTerms, seededRandom(7))).toEqual(
      buildMultipleChoiceQuestions(sixTerms, seededRandom(7)),
    );
  });

  it("uses fewer choices when the set has fewer than four terms", () => {
    const questions = buildMultipleChoiceQuestions(sixTerms.slice(0, 2), seededRandom(3));

    expect(questions).toHaveLength(2);
    for (const question of questions) {
      expect(question.choices).toHaveLength(2);
      expect(question.choices).toEqual(expect.arrayContaining(["hello", "goodbye"]));
    }
  });

  it("never offers duplicate choices or a wrong choice equal to the answer", () => {
    const terms = [
      term(1, "big", "large"),
      term(2, "huge", "Large "),
      term(3, "small", "little"),
      term(4, "tiny", "little"),
      term(5, "red", "a colour"),
    ];
    const questions = buildMultipleChoiceQuestions(terms, seededRandom(5));

    expect(questions).toHaveLength(5);
    for (const question of questions) {
      const normalized = question.choices.map(normalizeAnswer);
      expect(new Set(normalized).size).toBe(question.choices.length);
      // Only three different definitions exist, so at most three choices.
      expect(question.choices.length).toBe(3);
      const source = terms.find((t) => t.id === question.termId)!;
      expect(normalized.filter((c) => c === normalizeAnswer(source.definition))).toHaveLength(1);
      expect(question.choices[question.correctIndex]).toBe(source.definition);
    }
  });

  it("returns no questions when there are no different definitions to choose from", () => {
    expect(buildMultipleChoiceQuestions([sixTerms[0]])).toEqual([]);
    expect(buildMultipleChoiceQuestions([term(1, "a", "same"), term(2, "b", "SAME")])).toEqual([]);
    expect(canBuildMultipleChoice([term(1, "a", "same"), term(2, "b", "same")])).toBe(false);
    expect(canBuildMultipleChoice(sixTerms.slice(0, 2))).toBe(true);
  });
});
