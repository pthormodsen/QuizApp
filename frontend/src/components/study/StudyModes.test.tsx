import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { Term } from "../../api/types";
import FlashcardMode from "./FlashcardMode";
import MultipleChoiceMode from "./MultipleChoiceMode";
import WrittenMode from "./WrittenMode";

// Makes every shuffle keep the original order, so tests know what comes next.
const keepOrder = () => 0.9999999;

const terms: Term[] = [
  { id: 1, term: "hola", definition: "hello", orderIndex: 0 },
  { id: 2, term: "adiós", definition: "goodbye", orderIndex: 1 },
  { id: 3, term: "gracias", definition: "thank you", orderIndex: 2 },
];

describe("FlashcardMode", () => {
  it("shows the term first, reveals the definition, and moves between cards", () => {
    render(<FlashcardMode terms={terms} onExit={() => {}} random={keepOrder} />);

    expect(screen.getByText("Card 1 / 3")).toBeInTheDocument();
    const card = screen.getByRole("button", { name: "Term: hola. Show definition" });
    fireEvent.click(card);
    expect(screen.getByRole("button", { name: "Definition: hello. Show term" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Card 2 / 3")).toBeInTheDocument();
    // A new card starts on its term side.
    expect(screen.getByRole("button", { name: "Term: adiós. Show definition" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    expect(screen.getByText("Card 1 / 3")).toBeInTheDocument();
  });

  it("supports arrow keys and Space", () => {
    render(<FlashcardMode terms={terms} onExit={() => {}} random={keepOrder} />);

    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(screen.getByText("Card 2 / 3")).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByRole("button", { name: "Definition: goodbye. Show term" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(screen.getByText("Card 1 / 3")).toBeInTheDocument();
  });

  it("finishes after the last card and restarts from the first", () => {
    render(<FlashcardMode terms={terms} onExit={() => {}} random={keepOrder} />);

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByRole("button", { name: /Finish/ }));
    expect(screen.getByRole("heading", { name: "You went through all 3 cards" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(screen.getByText("Card 1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Term: hola. Show definition" })).toBeInTheDocument();
  });

  it("handles a single card and an empty set", () => {
    const onExit = vi.fn();
    const { unmount } = render(<FlashcardMode terms={terms.slice(0, 1)} onExit={onExit} />);
    expect(screen.getByText("Card 1 / 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Finish/ })).toBeEnabled();
    unmount();

    render(<FlashcardMode terms={[]} onExit={onExit} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to set" }));
    expect(onExit).toHaveBeenCalled();
  });
});

describe("MultipleChoiceMode", () => {
  const choice = (name: string) => screen.getByRole("button", { name: new RegExp(name) });

  it("scores answers, gives feedback and locks each question after one answer", () => {
    render(<MultipleChoiceMode terms={terms} onExit={() => {}} random={keepOrder} />);

    expect(screen.getByRole("heading", { name: "hola" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /hello|goodbye|thank you/ })).toHaveLength(3);
    fireEvent.click(choice("hello"));

    expect(screen.getByRole("status")).toHaveTextContent("Correct!");
    expect(screen.getByText("Score: 1")).toBeInTheDocument();
    // Answering again (click or number key) changes nothing.
    fireEvent.click(choice("goodbye"));
    fireEvent.keyDown(document.body, { key: "2" });
    expect(screen.getByText("Score: 1")).toBeInTheDocument();
    expect(choice("goodbye")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByRole("heading", { name: "adiós" })).toBeInTheDocument();
    fireEvent.click(choice("thank you"));
    expect(screen.getByRole("status")).toHaveTextContent("Not quite. The answer is: goodbye");
    expect(screen.getByText("Score: 1")).toBeInTheDocument();
  });

  it("answers with number keys, shows the final result and restarts", () => {
    render(<MultipleChoiceMode terms={terms} onExit={() => {}} random={keepOrder} />);

    // With the order kept, the correct definition is always the first choice.
    fireEvent.keyDown(document.body, { key: "1" });
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    fireEvent.keyDown(document.body, { key: "2" });
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    fireEvent.keyDown(document.body, { key: "1" });
    fireEvent.click(screen.getByRole("button", { name: "See results" }));

    expect(screen.getByRole("heading", { name: "2 of 3 correct" })).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    const review = screen.getByRole("list");
    expect(within(review).getByText("adiós")).toBeInTheDocument();
    expect(within(review).getByText("goodbye")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Score: 0")).toBeInTheDocument();
  });

  it("explains when the set can't make multiple choice questions", () => {
    render(<MultipleChoiceMode terms={terms.slice(0, 1)} onExit={() => {}} />);
    expect(screen.getByText(/needs at least two terms with different definitions/)).toBeInTheDocument();
  });
});

describe("WrittenMode", () => {
  const answerBox = () => screen.getByRole("textbox", { name: "Your answer" });
  const submit = (text: string) => {
    fireEvent.change(answerBox(), { target: { value: text } });
    fireEvent.submit(answerBox().closest("form")!);
  };

  it("accepts answers that differ only in case and whitespace and shows the expected answer", () => {
    render(<WrittenMode terms={terms} onExit={() => {}} random={keepOrder} />);

    expect(screen.getByRole("heading", { name: "hola" })).toBeInTheDocument();
    submit("  HELLO ");
    expect(screen.getByRole("status")).toHaveTextContent("Correct!");
    expect(screen.getByRole("status")).toHaveTextContent("Expected answer: hello");
    expect(answerBox()).toHaveAttribute("readonly");
    expect(screen.getByText("Score: 1")).toBeInTheDocument();

    // Enter again moves on; it can't re-grade the same term.
    fireEvent.submit(answerBox().closest("form")!);
    expect(screen.getByRole("heading", { name: "adiós" })).toBeInTheDocument();
    expect(answerBox()).toHaveValue("");

    submit("bye");
    expect(screen.getByRole("status")).toHaveTextContent("Not quite.");
    expect(screen.getByRole("status")).toHaveTextContent("Expected answer: goodbye");
    expect(screen.getByText("Score: 1")).toBeInTheDocument();
  });

  it("asks for an answer instead of grading an empty one, and offers Don't know", () => {
    render(<WrittenMode terms={terms} onExit={() => {}} random={keepOrder} />);

    submit("   ");
    expect(answerBox()).toHaveAccessibleDescription("Type an answer, or choose “Don't know”.");
    expect(screen.queryByText(/Expected answer/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Don't know" }));
    expect(screen.getByRole("status")).toHaveTextContent("Not answered.");
    expect(screen.getByText("Score: 0")).toBeInTheDocument();
  });

  it("goes through every term, shows the result and restarts", () => {
    render(<WrittenMode terms={terms} onExit={() => {}} random={keepOrder} />);

    submit("hello");
    fireEvent.click(screen.getByRole("button", { name: "Next term" }));
    submit("goodbye");
    fireEvent.click(screen.getByRole("button", { name: "Next term" }));
    submit("thanks");
    fireEvent.click(screen.getByRole("button", { name: "See results" }));

    expect(screen.getByRole("heading", { name: "2 of 3 correct" })).toBeInTheDocument();
    expect(screen.getByText(/You answered:/)).toHaveTextContent("You answered: thanks");

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(screen.getByText("Term 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Score: 0")).toBeInTheDocument();
  });
});
