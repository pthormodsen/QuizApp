import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import HomePage from "./HomePage";
import { resetDemoData } from "../api/client";

vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ logout: vi.fn() }) }));

// Runs against the in-memory demo data so the page exercises its real API calls,
// with BrowserRouter so the real window URL and history are used.
function renderAt(url: string) {
  window.history.pushState({}, "", url);
  resetDemoData();
  return render(
    <BrowserRouter>
      <HomePage />
    </BrowserRouter>,
  );
}

function tab(name: string) {
  return within(screen.getByRole("navigation", { name: "Content type" })).getByRole("button", { name });
}

async function historyGo(delta: number) {
  await act(async () => {
    window.history.go(delta);
    await new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
  });
}

beforeEach(() => {
  window.history.pushState({}, "", "/demo");
});

describe("HomePage tabs", () => {
  it("starts on study sets and switches between the two views", async () => {
    renderAt("/demo");

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
    renderAt("/demo");
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

  it("restores the URL-selected study set after switching to Quizzes and back", async () => {
    renderAt("/demo");
    fireEvent.click(await screen.findByRole("button", { name: "Web Security Terms" }));
    expect(window.location.search).toBe("?set=2");

    fireEvent.click(tab("Quizzes"));
    expect(screen.queryByRole("heading", { level: 2, name: "Web Security Terms" })).not.toBeInTheDocument();
    fireEvent.click(tab("Study sets"));

    expect(await screen.findByRole("heading", { level: 2, name: "Web Security Terms" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Web Security Terms")).toBeInTheDocument();
  });
});

describe("HomePage study set editing across tabs", () => {
  it("keeps unsaved study set details when switching to Quizzes and back", async () => {
    renderAt("/demo?set=1");
    const title = await screen.findByDisplayValue("Spanish Basics");

    fireEvent.change(title, { target: { value: "Spanish 101" } });
    fireEvent.click(tab("Quizzes"));
    expect(title).not.toBeVisible();
    fireEvent.click(tab("Study sets"));

    // Same field, still edited: the editor was hidden, not unmounted.
    expect(title).toBeVisible();
    expect(title).toHaveValue("Spanish 101");
    expect(screen.getByText("Unsaved changes")).toBeVisible();
  });
});

describe("HomePage study set URLs", () => {
  it("opens the editor for /demo?set=<id>", async () => {
    renderAt("/demo?set=1");

    expect(await screen.findByRole("heading", { level: 2, name: "Spanish Basics" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Spanish Basics")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("hola")).toBeInTheDocument();
  });

  it("works with ?demo=true and keeps it in the URL", async () => {
    renderAt("/?demo=true&set=1");

    expect(await screen.findByDisplayValue("Spanish Basics")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));
    expect(window.location.pathname + window.location.search).toBe("/?demo=true");
    expect(await screen.findByRole("button", { name: "Web Security Terms" })).toBeInTheDocument();
  });

  it("moves between the list and an editor with browser Back and Forward", async () => {
    renderAt("/demo");
    fireEvent.click(await screen.findByRole("button", { name: "Spanish Basics" }));
    expect(await screen.findByDisplayValue("Spanish Basics")).toBeInTheDocument();

    await historyGo(-1);
    expect(window.location.search).toBe("");
    expect(screen.getByRole("button", { name: "Spanish Basics" })).toHaveFocus();

    await historyGo(1);
    expect(window.location.search).toBe("?set=1");
    expect(screen.getByRole("heading", { level: 2, name: "Spanish Basics" })).toHaveFocus();
  });

  it("shows a not-found state for a nonexistent set", async () => {
    renderAt("/demo?set=12345");

    expect(await screen.findByRole("heading", { name: "Study set not found" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));
    expect(await screen.findByRole("button", { name: "Spanish Basics" })).toBeInTheDocument();
  });
});

describe("HomePage study sessions", () => {
  it("moves between a set and a study session with browser Back and Forward in demo mode", async () => {
    renderAt("/demo?set=1");
    fireEvent.click(await screen.findByRole("button", { name: /^Flashcards/ }));
    expect(window.location.search).toBe("?set=1&study=flashcards");
    expect(await screen.findByText(/^Card 1 \//)).toBeInTheDocument();

    await historyGo(-1);
    expect(window.location.search).toBe("?set=1");
    expect(screen.getByRole("button", { name: /^Flashcards/ })).toHaveFocus();

    await historyGo(1);
    expect(screen.getByRole("heading", { level: 2, name: "Spanish Basics" })).toHaveFocus();
    expect(await screen.findByText(/^Card 1 \//)).toBeInTheDocument();
  });

  it("keeps the study session while visiting the Quizzes tab", async () => {
    renderAt("/demo?set=1&study=flashcards");
    expect(await screen.findByText(/^Card 1 \//)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));

    fireEvent.click(tab("Quizzes"));
    // Shortcuts don't reach the hidden session.
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.click(tab("Study sets"));

    expect(screen.getByText(/^Card 2 \//)).toBeVisible();
  });
});
