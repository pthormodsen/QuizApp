import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import HomePage from "./HomePage";
import { resetDemoData } from "../api/client";

vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ logout: vi.fn() }) }));

// Runs against the in-memory demo data so the page exercises its real API calls.
beforeEach(() => {
  window.history.pushState({}, "", "/demo");
  resetDemoData();
});

function tab(name: string) {
  return within(screen.getByRole("navigation", { name: "Content type" })).getByRole("button", { name });
}

describe("HomePage tabs", () => {
  it("starts on study sets and switches between the two views", async () => {
    render(<HomePage />);

    expect(await screen.findByRole("button", { name: "Spanish Basics" })).toBeInTheDocument();
    expect(tab("Study sets")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("heading", { name: "Available Quizzes" })).not.toBeInTheDocument();

    fireEvent.click(tab("Quizzes"));

    expect(tab("Quizzes")).toHaveAttribute("aria-current", "page");
    expect(tab("Study sets")).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { name: "Available Quizzes" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your study sets" })).not.toBeInTheDocument();
  });

  it("keeps an in-progress quiz when switching tabs and back", async () => {
    render(<HomePage />);
    fireEvent.click(tab("Quizzes"));

    const card = (await screen.findByRole("heading", { name: "Frontend Fundamentals" })).closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: "Start Quiz" }));
    expect(await screen.findByText(/Question 1 of/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Question 2 of/)).toBeInTheDocument();

    fireEvent.click(tab("Study sets"));
    expect(screen.getByText(/Question 2 of/)).not.toBeVisible();
    fireEvent.click(tab("Quizzes"));

    expect(screen.getByText(/Question 2 of/)).toBeVisible();
  });
});
