import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TermEditor from "./TermEditor";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../api/client";
import type { Term } from "../api/types";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn() };
});

const mockedApiGet = vi.mocked(apiGet);
const mockedApiPost = vi.mocked(apiPost);
const mockedApiPatch = vi.mocked(apiPatch);
const mockedApiDelete = vi.mocked(apiDelete);

const terms: Term[] = [
  { id: 1, term: "hola", definition: "hello", orderIndex: 0 },
  { id: 2, term: "adiós", definition: "goodbye", orderIndex: 1 },
];

beforeEach(() => {
  mockedApiGet.mockReset();
  mockedApiPost.mockReset();
  mockedApiPatch.mockReset();
  mockedApiDelete.mockReset();
  mockedApiGet.mockResolvedValue(terms);
});

describe("TermEditor", () => {
  it("renders terms in order and reports the term count", async () => {
    const onTermCountChanged = vi.fn();
    render(<TermEditor studySetId={7} onTermCountChanged={onTermCountChanged} />);

    await waitFor(() => expect(screen.getByDisplayValue("hola")).toBeInTheDocument());
    expect(mockedApiGet).toHaveBeenCalledWith("/api/study-sets/7/terms", expect.any(AbortSignal));
    const termValues = screen
      .getAllByRole("textbox", { name: "Term" })
      .map((el) => (el as HTMLTextAreaElement).value);
    expect(termValues).toEqual(["hola", "adiós"]);
    expect(onTermCountChanged).toHaveBeenLastCalledWith(2);
  });

  it("adds a term and keeps the inputs when saving fails", async () => {
    const onTermCountChanged = vi.fn();
    mockedApiPost.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
    render(<TermEditor studySetId={7} onTermCountChanged={onTermCountChanged} />);
    await waitFor(() => expect(screen.getByDisplayValue("hola")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Term"), { target: { value: "gracias" } });
    fireEvent.change(screen.getByPlaceholderText("Definition"), { target: { value: "thanks" } });
    fireEvent.click(screen.getByRole("button", { name: "Add term" }));

    await waitFor(() => expect(screen.getByText("Server unavailable")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("Term")).toHaveValue("gracias");

    mockedApiPost.mockResolvedValueOnce({ id: 3, term: "gracias", definition: "thanks", orderIndex: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Add term" }));

    await waitFor(() => expect(screen.getAllByRole("textbox", { name: "Term" })).toHaveLength(3));
    expect(mockedApiPost).toHaveBeenLastCalledWith("/api/study-sets/7/terms", {
      term: "gracias",
      definition: "thanks",
    });
    expect(screen.getByPlaceholderText("Term")).toHaveValue("");
    expect(onTermCountChanged).toHaveBeenLastCalledWith(3);
  });

  it("sends the full new order when a term is moved", async () => {
    mockedApiPatch.mockResolvedValue([
      { ...terms[1], orderIndex: 0 },
      { ...terms[0], orderIndex: 1 },
    ]);
    render(<TermEditor studySetId={7} onTermCountChanged={() => {}} />);
    await waitFor(() => expect(screen.getByDisplayValue("hola")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: 'Move "adiós" up' }));

    await waitFor(() =>
      expect(mockedApiPatch).toHaveBeenCalledWith("/api/study-sets/7/terms/reorder", {
        termIds: [2, 1],
      }),
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("textbox", { name: "Term" }).map((el) => (el as HTMLTextAreaElement).value),
      ).toEqual(["adiós", "hola"]),
    );
  });

  it("returns focus to the term input after adding a term", async () => {
    mockedApiPost.mockResolvedValueOnce({ id: 3, term: "gracias", definition: "thanks", orderIndex: 2 });
    render(<TermEditor studySetId={7} onTermCountChanged={() => {}} />);
    await waitFor(() => expect(screen.getByDisplayValue("hola")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Term"), { target: { value: "gracias" } });
    fireEvent.change(screen.getByPlaceholderText("Definition"), { target: { value: "thanks" } });
    fireEvent.click(screen.getByRole("button", { name: "Add term" }));

    await waitFor(() => expect(screen.getAllByRole("textbox", { name: "Term" })).toHaveLength(3));
    expect(screen.getByPlaceholderText("Term")).toHaveFocus();
  });

  it("keeps focus on the moved term when it reaches the top", async () => {
    mockedApiPatch.mockResolvedValue([
      { ...terms[1], orderIndex: 0 },
      { ...terms[0], orderIndex: 1 },
    ]);
    render(<TermEditor studySetId={7} onTermCountChanged={() => {}} />);
    await waitFor(() => expect(screen.getByDisplayValue("hola")).toBeInTheDocument());

    const moveUp = screen.getByRole("button", { name: 'Move "adiós" up' });
    moveUp.focus();
    fireEvent.click(moveUp);

    // "Move up" is now disabled at the top, so focus falls back to "Move down" on the same term.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: 'Move "adiós" down' })).toHaveFocus(),
    );
  });

  it("moves focus to the terms heading after deleting a term", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedApiDelete.mockResolvedValue(undefined);
    render(<TermEditor studySetId={7} onTermCountChanged={() => {}} />);
    await waitFor(() => expect(screen.getByDisplayValue("hola")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => expect(screen.queryByDisplayValue("hola")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: /Terms/ })).toHaveFocus();
  });
});
