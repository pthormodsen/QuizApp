import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Term } from "../../api/types";

export type StudyMode = "flashcards" | "multiple-choice" | "written";

export type StudyModeInfo = {
  mode: StudyMode;
  label: string;
  description: string;
  /** Fewest terms the mode needs to make sense. */
  minTerms: number;
};

export const STUDY_MODES: readonly StudyModeInfo[] = [
  {
    mode: "flashcards",
    label: "Flashcards",
    description: "Flip through terms and recall each definition.",
    minTerms: 1,
  },
  {
    mode: "multiple-choice",
    label: "Multiple choice",
    description: "Pick the right definition from a few options.",
    minTerms: 2,
  },
  {
    mode: "written",
    label: "Written",
    description: "Type each definition from memory.",
    minTerms: 1,
  },
];

export function parseStudyMode(value: string | null): StudyMode | null {
  return STUDY_MODES.find((info) => info.mode === value)?.mode ?? null;
}

export function studyModeInfo(mode: StudyMode): StudyModeInfo {
  return STUDY_MODES.find((info) => info.mode === mode)!;
}

/** Returns a number in [0, 1), like Math.random. Injectable so tests are deterministic. */
export type Random = () => number;

/** Small seeded generator (mulberry32) for reproducible shuffles in tests. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Comparison form of an answer: trimmed, case-insensitive, with runs of whitespace collapsed. */
export function normalizeAnswer(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function isCorrectAnswer(answer: string, expected: string): boolean {
  return normalizeAnswer(answer) === normalizeAnswer(expected);
}

export type ChoiceQuestion = {
  termId: number;
  prompt: string;
  answer: string;
  choices: string[];
  correctIndex: number;
};

/** Distinct definitions (by normalized text), keeping the first spelling of each. */
function distinctDefinitions(terms: readonly Term[]): Map<string, string> {
  const definitions = new Map<string, string>();
  for (const term of terms) {
    const key = normalizeAnswer(term.definition);
    if (!definitions.has(key)) {
      definitions.set(key, term.definition);
    }
  }
  return definitions;
}

/** Multiple choice needs at least two different definitions to have any wrong options. */
export function canBuildMultipleChoice(terms: readonly Term[]): boolean {
  return distinctDefinitions(terms).size >= 2;
}

/**
 * One question per term, in random order: the term is the prompt and its definition the
 * answer, with other terms' definitions as wrong options (up to maxChoices in total).
 * Definitions that match after normalization count as the same choice, so a question never
 * shows the same text twice or a "wrong" option equal to the answer.
 */
export function buildMultipleChoiceQuestions(
  terms: readonly Term[],
  random: Random = Math.random,
  maxChoices = 4,
): ChoiceQuestion[] {
  const definitions = distinctDefinitions(terms);
  if (definitions.size < 2) {
    return [];
  }

  return shuffle(terms, random).map((term) => {
    const answerKey = normalizeAnswer(term.definition);
    const distractors = shuffle(
      [...definitions].filter(([key]) => key !== answerKey).map(([, text]) => text),
      random,
    ).slice(0, maxChoices - 1);
    const choices = shuffle([term.definition, ...distractors], random);
    return {
      termId: term.id,
      prompt: term.term,
      answer: term.definition,
      choices,
      correctIndex: choices.indexOf(term.definition),
    };
  });
}

/**
 * Single-key shortcuts for a study mode, active only while the mode is visible (the
 * Study Sets panel stays mounted but hidden on the Quizzes tab) and the user isn't typing.
 */
export function useStudyShortcuts(
  rootRef: RefObject<HTMLElement | null>,
  onKey: (event: KeyboardEvent) => void,
) {
  const handler = useRef(onKey);
  useEffect(() => {
    handler.current = onKey;
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const root = rootRef.current;
      const target = event.target as HTMLElement | null;
      if (
        !root ||
        root.closest("[hidden]") ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      handler.current(event);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [rootRef]);
}
