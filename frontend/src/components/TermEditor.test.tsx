import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
const threeTerms: Term[] = [...terms, { id: 3, term: "gracias", definition: "thanks", orderIndex: 2 }];

const termValues = () =>
  screen
    .getAllByRole("textbox", { name: /^Term \d+$/ })
    .map((el) => (el as HTMLTextAreaElement).value);

async function renderEditor(onTermCountChanged: (count: number) => void = () => {}) {
  render(<TermEditor studySetId={7} onTermCountChanged={onTermCountChanged} />);
  await screen.findByDisplayValue("hola");
}

beforeEach(() => {
  mockedApiGet.mockReset();
  mockedApiPost.mockReset();
  mockedApiPatch.mockReset();
  mockedApiDelete.mockReset();
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockedApiGet.mockResolvedValue(terms);
});

describe("TermEditor", () => {
  it("renders terms in order and reports the term count", async () => {
    const onTermCountChanged = vi.fn();
    await renderEditor(onTermCountChanged);

    expect(mockedApiGet).toHaveBeenCalledWith("/api/study-sets/7/terms", expect.any(AbortSignal));
    expect(termValues()).toEqual(["hola", "adiós"]);
    await waitFor(() => expect(onTermCountChanged).toHaveBeenLastCalledWith(2));
  });

  it("gives every field a visible label and the backend's length limits", async () => {
    await renderEditor();

    for (const name of ["Term 1", "Term 2", "New Term"]) {
      expect(screen.getByRole("textbox", { name })).toHaveAttribute("maxlength", "500");
    }
    for (const name of ["Definition 1", "Definition 2", "New Definition"]) {
      expect(screen.getByRole("textbox", { name })).toHaveAttribute("maxlength", "1000");
    }
    // The visible label text is "Term"/"Definition"; the number/"New" is for screen readers.
    expect(screen.getAllByText("Term", { selector: "label" })).toHaveLength(3);
  });

  it("gives the icon-only row controls descriptive names", async () => {
    await renderEditor();

    expect(screen.getByRole("button", { name: 'Move "hola" up' })).toBeDisabled();
    expect(screen.getByRole("button", { name: 'Move "hola" down' })).toBeEnabled();
    expect(screen.getByRole("button", { name: 'Move "adiós" down' })).toBeDisabled();
    expect(screen.getByRole("button", { name: 'Delete "adiós"' })).toBeEnabled();
  });

  it("adds a term and keeps the inputs when saving fails", async () => {
    const onTermCountChanged = vi.fn();
    mockedApiPost.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
    await renderEditor(onTermCountChanged);

    fireEvent.change(screen.getByLabelText("New Term"), { target: { value: "gracias" } });
    fireEvent.change(screen.getByLabelText("New Definition"), { target: { value: "thanks" } });
    fireEvent.click(screen.getByRole("button", { name: "Add term" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
    expect(screen.getByLabelText("New Term")).toHaveValue("gracias");

    mockedApiPost.mockResolvedValueOnce({ id: 3, term: "gracias", definition: "thanks", orderIndex: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Add term" }));

    await waitFor(() => expect(termValues()).toEqual(["hola", "adiós", "gracias"]));
    expect(mockedApiPost).toHaveBeenLastCalledWith("/api/study-sets/7/terms", {
      term: "gracias",
      definition: "thanks",
    });
    expect(screen.getByLabelText("New Term")).toHaveValue("");
    await waitFor(() => expect(screen.getByLabelText("New Term")).toHaveFocus());
    await waitFor(() => expect(onTermCountChanged).toHaveBeenLastCalledWith(3));
  });

  it("adds a term with Enter and inserts a line break with Shift+Enter", async () => {
    mockedApiPost.mockResolvedValueOnce({ id: 3, term: "gracias", definition: "thanks", orderIndex: 2 });
    await renderEditor();

    const definition = screen.getByLabelText("New Definition");
    fireEvent.change(screen.getByLabelText("New Term"), { target: { value: "gracias" } });
    fireEvent.change(definition, { target: { value: "thanks" } });
    expect(fireEvent.keyDown(definition, { key: "Enter", shiftKey: true })).toBe(true);
    expect(mockedApiPost).not.toHaveBeenCalled();

    fireEvent.keyDown(definition, { key: "Enter" });

    await waitFor(() => expect(termValues()).toHaveLength(3));
  });

  it("does not add a term twice when Enter is pressed again while the request is running", async () => {
    let resolvePost!: (term: Term) => void;
    mockedApiPost.mockReturnValueOnce(new Promise((resolve) => (resolvePost = resolve)));
    await renderEditor();

    const definition = screen.getByLabelText("New Definition");
    fireEvent.change(screen.getByLabelText("New Term"), { target: { value: "gracias" } });
    fireEvent.change(definition, { target: { value: "thanks" } });
    fireEvent.keyDown(definition, { key: "Enter" });
    fireEvent.keyDown(definition, { key: "Enter" });
    fireEvent.keyDown(definition, { key: "Enter" });

    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
    await act(async () => resolvePost({ id: 3, term: "gracias", definition: "thanks", orderIndex: 2 }));

    expect(mockedApiPost).toHaveBeenCalledTimes(1);
    expect(termValues()).toEqual(["hola", "adiós", "gracias"]);
  });

  it("shows required-field errors next to the empty new-term fields", async () => {
    await renderEditor();

    fireEvent.change(screen.getByLabelText("New Term"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add term" }));

    expect(mockedApiPost).not.toHaveBeenCalled();
    const term = screen.getByLabelText("New Term");
    const definition = screen.getByLabelText("New Definition");
    expect(term).toHaveAttribute("aria-invalid", "true");
    expect(term).toHaveAccessibleDescription("Term is required");
    expect(definition).toHaveAccessibleDescription("Definition is required");

    fireEvent.change(term, { target: { value: "gracias" } });
    expect(term).not.toHaveAttribute("aria-invalid");
    expect(definition).toHaveAccessibleDescription("Definition is required");
  });

  it("shows backend field errors next to the matching field instead of 'Validation failed'", async () => {
    mockedApiPost.mockRejectedValueOnce(
      new ApiError(400, "Validation failed", { definition: "Definition must be at most 1000 characters" }),
    );
    await renderEditor();

    fireEvent.change(screen.getByLabelText("New Term"), { target: { value: "gracias" } });
    fireEvent.change(screen.getByLabelText("New Definition"), { target: { value: "thanks" } });
    fireEvent.click(screen.getByRole("button", { name: "Add term" }));

    await waitFor(() =>
      expect(screen.getByLabelText("New Definition")).toHaveAccessibleDescription(
        "Definition must be at most 1000 characters",
      ),
    );
    expect(screen.queryByText("Validation failed")).not.toBeInTheDocument();
  });

  describe("autosaving existing terms", () => {
    const row = (position: number) =>
      screen.getByRole("textbox", { name: `Term ${position}` }).closest("li")!;
    // Focus leaving the row entirely, e.g. to the add-term form.
    const leaveRow = (field: HTMLElement) =>
      fireEvent.blur(field, { relatedTarget: screen.getByLabelText("New Term") });

    it("saves a changed term when focus leaves the row, not when moving within it", async () => {
      mockedApiPatch.mockResolvedValueOnce({ ...terms[0], term: "buenos días" });
      await renderEditor();

      const term = screen.getByRole("textbox", { name: "Term 1" });
      const definition = screen.getByRole("textbox", { name: "Definition 1" });
      fireEvent.change(term, { target: { value: "buenos días " } });
      expect(within(row(1)).getByRole("status")).toHaveTextContent("Unsaved");
      fireEvent.blur(term, { relatedTarget: definition });
      expect(mockedApiPatch).not.toHaveBeenCalled();

      leaveRow(definition);

      expect(within(row(1)).getByRole("status")).toHaveTextContent("Saving…");
      expect(mockedApiPatch).toHaveBeenCalledWith("/api/study-sets/7/terms/1", {
        term: "buenos días",
        definition: "hello",
      });
      await waitFor(() => expect(within(row(1)).getByRole("status")).toHaveTextContent("Saved"));
      expect(term).toHaveValue("buenos días");
    });

    it("does not save unchanged or whitespace-only edits", async () => {
      await renderEditor();

      const term = screen.getByRole("textbox", { name: "Term 1" });
      leaveRow(term);
      fireEvent.change(term, { target: { value: "  hola " } });
      leaveRow(term);

      expect(mockedApiPatch).not.toHaveBeenCalled();
      expect(term).toHaveValue("hola");
    });

    it.each([
      ["Ctrl+Enter", { ctrlKey: true }],
      ["Cmd+Enter", { metaKey: true }],
    ])("saves immediately with %s and keeps focus in the field", async (_, modifier) => {
      mockedApiPatch.mockResolvedValueOnce({ ...terms[0], definition: "hi" });
      await renderEditor();

      const definition = screen.getByRole("textbox", { name: "Definition 1" });
      definition.focus();
      fireEvent.change(definition, { target: { value: "hi" } });
      fireEvent.keyDown(definition, { key: "Enter", ...modifier });

      expect(mockedApiPatch).toHaveBeenCalledWith("/api/study-sets/7/terms/1", {
        term: "hola",
        definition: "hi",
      });
      await waitFor(() => expect(within(row(1)).getByRole("status")).toHaveTextContent("Saved"));
      expect(definition).toHaveFocus();
    });

    it("restores the last saved values with Escape", async () => {
      await renderEditor();

      const term = screen.getByRole("textbox", { name: "Term 2" });
      fireEvent.change(term, { target: { value: "chau" } });
      fireEvent.keyDown(term, { key: "Escape" });

      expect(term).toHaveValue("adiós");
      leaveRow(term);
      expect(mockedApiPatch).not.toHaveBeenCalled();
    });

    it("saves edits made during a running save afterwards, without overlapping requests", async () => {
      let resolveFirst!: (term: Term) => void;
      mockedApiPatch.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)));
      mockedApiPatch.mockResolvedValueOnce({ ...terms[0], term: "buenas", definition: "hi" });
      await renderEditor();

      const term = screen.getByRole("textbox", { name: "Term 1" });
      const definition = screen.getByRole("textbox", { name: "Definition 1" });
      fireEvent.change(term, { target: { value: "buenas" } });
      leaveRow(term);
      fireEvent.change(definition, { target: { value: "hi" } });
      leaveRow(definition);
      expect(mockedApiPatch).toHaveBeenCalledTimes(1);

      await act(async () => resolveFirst({ ...terms[0], term: "buenas" }));

      await waitFor(() => expect(mockedApiPatch).toHaveBeenCalledTimes(2));
      expect(mockedApiPatch).toHaveBeenLastCalledWith("/api/study-sets/7/terms/1", {
        term: "buenas",
        definition: "hi",
      });
      expect(definition).toHaveValue("hi");
      await waitFor(() => expect(within(row(1)).getByRole("status")).toHaveTextContent("Saved"));
    });

    it("keeps a failed edit with Retry and Undo changes, and shows backend field errors", async () => {
      mockedApiPatch.mockRejectedValueOnce(
        new ApiError(400, "Validation failed", { term: "Term must be at most 500 characters" }),
      );
      mockedApiPatch.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
      await renderEditor();

      const term = screen.getByRole("textbox", { name: "Term 2" });
      fireEvent.change(term, { target: { value: "adiós amigo" } });
      leaveRow(term);

      await waitFor(() =>
        expect(term).toHaveAccessibleDescription("Term must be at most 500 characters"),
      );
      expect(term).toHaveValue("adiós amigo");
      expect(within(row(2)).getByRole("status")).toHaveTextContent("Couldn't save");
      expect(screen.queryByText("Validation failed")).not.toBeInTheDocument();

      leaveRow(term);
      expect(await within(row(2)).findByRole("alert")).toHaveTextContent("Server unavailable");

      mockedApiPatch.mockResolvedValueOnce({ ...terms[1], term: "adiós amigo" });
      fireEvent.click(within(row(2)).getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(within(row(2)).getByRole("status")).toHaveTextContent("Saved"));
      expect(mockedApiPatch).toHaveBeenCalledTimes(3);
    });

    it("can undo a failed edit back to the saved values", async () => {
      mockedApiPatch.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
      await renderEditor();

      const term = screen.getByRole("textbox", { name: "Term 2" });
      fireEvent.change(term, { target: { value: "chau" } });
      leaveRow(term);
      fireEvent.click(await within(row(2)).findByRole("button", { name: "Undo changes" }));

      expect(term).toHaveValue("adiós");
      expect(within(row(2)).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not save a term with an empty definition", async () => {
      await renderEditor();

      const definition = screen.getByRole("textbox", { name: "Definition 1" });
      fireEvent.change(definition, { target: { value: " " } });
      leaveRow(definition);

      expect(mockedApiPatch).not.toHaveBeenCalled();
      expect(definition).toHaveAccessibleDescription("Definition is required");
      expect(within(row(1)).getByRole("status")).toHaveTextContent("Couldn't save");
    });

    it("reports the combined save state, counting an un-added new term as unsaved", async () => {
      let resolveSave!: (term: Term) => void;
      mockedApiPatch.mockReturnValueOnce(new Promise((resolve) => (resolveSave = resolve)));
      const onStatusChange = vi.fn();
      render(<TermEditor studySetId={7} onTermCountChanged={() => {}} onStatusChange={onStatusChange} />);
      await screen.findByDisplayValue("hola");

      const term = screen.getByRole("textbox", { name: "Term 1" });
      fireEvent.change(term, { target: { value: "buenas" } });
      expect(onStatusChange).toHaveBeenLastCalledWith("unsaved");
      leaveRow(term);
      expect(onStatusChange).toHaveBeenLastCalledWith("saving");
      await act(async () => resolveSave({ ...terms[0], term: "buenas" }));
      expect(onStatusChange).toHaveBeenLastCalledWith("saved");

      fireEvent.change(screen.getByLabelText("New Term"), { target: { value: "gracias" } });
      expect(onStatusChange).toHaveBeenLastCalledWith("unsaved");
    });

    it("saves pending row edits when the editor closes, unless they were discarded", async () => {
      mockedApiPatch.mockResolvedValue({ ...terms[0], term: "buenas" });
      const first = render(<TermEditor studySetId={7} onTermCountChanged={() => {}} />);
      await screen.findByDisplayValue("hola");
      fireEvent.change(screen.getByRole("textbox", { name: "Term 1" }), { target: { value: "buenas" } });
      first.unmount();
      expect(mockedApiPatch).toHaveBeenCalledTimes(1);

      const second = render(
        <TermEditor studySetId={7} onTermCountChanged={() => {}} isDiscarded={() => true} />,
      );
      await screen.findByDisplayValue("hola");
      fireEvent.change(screen.getByRole("textbox", { name: "Term 1" }), { target: { value: "buenas" } });
      second.unmount();
      expect(mockedApiPatch).toHaveBeenCalledTimes(1);
    });

    it("ignores Escape while a save is running, so the saved edit isn't shown as undone", async () => {
      let resolveSave!: (term: Term) => void;
      mockedApiPatch.mockReturnValueOnce(new Promise((resolve) => (resolveSave = resolve)));
      await renderEditor();

      const term = screen.getByRole("textbox", { name: "Term 1" });
      fireEvent.change(term, { target: { value: "buenas" } });
      fireEvent.keyDown(term, { key: "Enter", ctrlKey: true });
      fireEvent.keyDown(term, { key: "Escape" });
      expect(term).toHaveValue("buenas");

      await act(async () => resolveSave({ ...terms[0], term: "buenas" }));
      expect(within(row(1)).getByRole("status")).toHaveTextContent("Saved");
    });

    it("shows a failed delete as a delete error, not a save error", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      mockedApiDelete.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
      await renderEditor();

      fireEvent.change(screen.getByRole("textbox", { name: "Term 1" }), { target: { value: "x" } });
      fireEvent.click(screen.getByRole("button", { name: 'Delete "hola"' }));

      expect(await within(row(1)).findByRole("alert")).toHaveTextContent("Server unavailable");
      expect(within(row(1)).getByRole("status")).toHaveTextContent("Unsaved");
      expect(within(row(1)).queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    });

    it("does not save the edits of a term that was deleted", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      mockedApiDelete.mockResolvedValue(undefined);
      await renderEditor();

      fireEvent.change(screen.getByRole("textbox", { name: "Term 1" }), { target: { value: "x" } });
      fireEvent.click(screen.getByRole("button", { name: 'Delete "hola"' }));

      await waitFor(() => expect(termValues()).toEqual(["adiós"]));
      expect(mockedApiPatch).not.toHaveBeenCalled();
    });
  });

  it("sends the full new order when a term is moved", async () => {
    mockedApiPatch.mockResolvedValue([
      { ...terms[1], orderIndex: 0 },
      { ...terms[0], orderIndex: 1 },
    ]);
    await renderEditor();

    fireEvent.click(screen.getByRole("button", { name: 'Move "adiós" up' }));

    await waitFor(() =>
      expect(mockedApiPatch).toHaveBeenCalledWith("/api/study-sets/7/terms/reorder", {
        termIds: [2, 1],
      }),
    );
    await waitFor(() => expect(termValues()).toEqual(["adiós", "hola"]));
    expect(screen.getByText('Moved "adiós" to position 1 of 2.')).toBeInTheDocument();
  });

  it("keeps focus on the moved term when it reaches the top", async () => {
    mockedApiPatch.mockResolvedValue([
      { ...terms[1], orderIndex: 0 },
      { ...terms[0], orderIndex: 1 },
    ]);
    await renderEditor();

    const moveUp = screen.getByRole("button", { name: 'Move "adiós" up' });
    moveUp.focus();
    fireEvent.click(moveUp);

    // "Move up" is now disabled at the top, so focus falls back to "Move down" on the same term.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: 'Move "adiós" down' })).toHaveFocus(),
    );
  });

  it("shows an error and keeps the order when reordering fails", async () => {
    mockedApiPatch.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
    await renderEditor();

    fireEvent.click(screen.getByRole("button", { name: 'Move "hola" down' }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
    expect(termValues()).toEqual(["hola", "adiós"]);
  });

  it("deletes a term after confirmation and focuses the next term's delete button", async () => {
    mockedApiGet.mockResolvedValue(threeTerms);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedApiDelete.mockResolvedValue(undefined);
    const onTermCountChanged = vi.fn();
    await renderEditor(onTermCountChanged);

    const deleteButton = screen.getByRole("button", { name: 'Delete "adiós"' });
    deleteButton.focus();
    fireEvent.click(deleteButton);

    await waitFor(() => expect(termValues()).toEqual(["hola", "gracias"]));
    expect(mockedApiDelete).toHaveBeenCalledWith("/api/study-sets/7/terms/2");
    await waitFor(() => expect(screen.getByRole("button", { name: 'Delete "gracias"' })).toHaveFocus());
    await waitFor(() => expect(onTermCountChanged).toHaveBeenLastCalledWith(2));
  });

  it("focuses the previous term after deleting the last one, then the new-term input", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedApiDelete.mockResolvedValue(undefined);
    await renderEditor();

    fireEvent.click(screen.getByRole("button", { name: 'Delete "adiós"' }));
    await waitFor(() => expect(termValues()).toEqual(["hola"]));
    await waitFor(() => expect(screen.getByRole("button", { name: 'Delete "hola"' })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: 'Delete "hola"' }));
    expect(await screen.findByText("No terms yet. Add your first term below.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("New Term")).toHaveFocus());
  });

  it("does not delete when the confirmation is cancelled, and shows delete failures", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderEditor();

    fireEvent.click(screen.getByRole("button", { name: 'Delete "hola"' }));
    expect(mockedApiDelete).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    mockedApiDelete.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
    fireEvent.click(screen.getByRole("button", { name: 'Delete "hola"' }));

    const row = screen.getByRole("textbox", { name: "Term 1" }).closest("li")!;
    expect(await within(row).findByRole("alert")).toHaveTextContent("Server unavailable");
    expect(termValues()).toEqual(["hola", "adiós"]);
    expect(within(row).getByRole("button", { name: 'Delete "hola"' })).toBeEnabled();
  });

  it("shows a retryable error when the terms fail to load", async () => {
    mockedApiGet.mockRejectedValueOnce(new Error("network down"));
    render(<TermEditor studySetId={7} onTermCountChanged={() => {}} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the terms");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByDisplayValue("hola")).toBeInTheDocument();
  });
});
