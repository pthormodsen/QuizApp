import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StudySetsPanel from "./StudySetsPanel";
import { apiDelete, apiGet } from "../api/client";
import type { StudySet } from "../api/types";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, apiGet: vi.fn(), apiDelete: vi.fn() };
});

const mockedApiGet = vi.mocked(apiGet);
const mockedApiDelete = vi.mocked(apiDelete);

const spanish: StudySet = {
  id: 1,
  title: "Spanish Basics",
  description: "Greetings",
  termCount: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const french: StudySet = { ...spanish, id: 2, title: "French Basics", description: null };

// Routes GET requests by path so the term editor can load too.
function serve(studySets: StudySet[]) {
  mockedApiGet.mockImplementation(async (path: string) =>
    path === "/api/study-sets" ? studySets : [],
  );
}

beforeEach(() => {
  mockedApiGet.mockReset();
  mockedApiDelete.mockReset();
  vi.restoreAllMocks();
});

describe("StudySetsPanel", () => {
  it("shows the empty state and opens the create form from it", async () => {
    serve([]);
    render(<StudySetsPanel />);

    expect(await screen.findByRole("heading", { name: "Create your first study set" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New study set" }));

    expect(screen.getByRole("heading", { name: "Create study set" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create your first study set" })).not.toBeInTheDocument();
  });

  it("shows a load error and recovers on retry", async () => {
    mockedApiGet.mockRejectedValueOnce(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<StudySetsPanel />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your study sets");

    serve([spanish]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("button", { name: "Spanish Basics" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("deletes a set after confirmation and moves focus to the list heading", async () => {
    serve([spanish, french]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedApiDelete.mockResolvedValue(undefined);
    render(<StudySetsPanel />);

    const deleteButton = await screen.findByRole("button", { name: 'Delete "Spanish Basics"' });
    deleteButton.focus();
    fireEvent.click(deleteButton);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Spanish Basics" })).not.toBeInTheDocument(),
    );
    expect(mockedApiDelete).toHaveBeenCalledWith("/api/study-sets/1");
    expect(screen.getByRole("button", { name: "French Basics" })).toBeInTheDocument();
    expect(screen.getByText("1 set")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your study sets" })).toHaveFocus();
  });

  it("does not delete when the confirmation is cancelled", async () => {
    serve([spanish]);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<StudySetsPanel />);

    fireEvent.click(await screen.findByRole("button", { name: 'Delete "Spanish Basics"' }));

    expect(mockedApiDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Spanish Basics" })).toBeInTheDocument();
  });

  it("opens a set in the editor and returns to the list", async () => {
    serve([spanish, french]);
    render(<StudySetsPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Spanish Basics" }));

    expect(screen.getByText("Editing study set")).toBeInTheDocument();
    expect(await screen.findByText("No terms yet. Add your first term below.")).toBeInTheDocument();
    expect(mockedApiGet).toHaveBeenCalledWith("/api/study-sets/1/terms", expect.any(AbortSignal));

    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));

    expect(screen.getByRole("button", { name: "Spanish Basics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "French Basics" })).toBeInTheDocument();
  });
});
