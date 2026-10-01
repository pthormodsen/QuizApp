import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import StudySetsPanel, { type StudySetsPanelHandle } from "./StudySetsPanel";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../api/client";
import type { StudySet } from "../api/types";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn() };
});

const mockedApiGet = vi.mocked(apiGet);
const mockedApiPost = vi.mocked(apiPost);
const mockedApiDelete = vi.mocked(apiDelete);
const mockedApiPatch = vi.mocked(apiPatch);

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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="search">{location.search}</output>;
}

// Stands in for the browser's Back button.
function HistoryBack() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Browser back
    </button>
  );
}

function renderPanel(initialEntry = "/", ref?: React.Ref<StudySetsPanelHandle>) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <StudySetsPanel ref={ref} />
      <LocationProbe />
      <HistoryBack />
    </MemoryRouter>,
  );
}

const currentSearch = () => screen.getByTestId("search").textContent;

beforeEach(() => {
  mockedApiGet.mockReset();
  mockedApiPost.mockReset();
  mockedApiDelete.mockReset();
  mockedApiPatch.mockReset();
  vi.restoreAllMocks();
});

describe("StudySetsPanel", () => {
  it("shows the empty state and opens the create form from it", async () => {
    serve([]);
    renderPanel();

    expect(await screen.findByRole("heading", { name: "Create your first study set" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New study set" }));

    expect(currentSearch()).toBe("?set=new");
    expect(screen.getByRole("heading", { name: "Create study set" })).toHaveFocus();
    expect(screen.queryByRole("heading", { name: "Create your first study set" })).not.toBeInTheDocument();
  });

  it("shows a load error and recovers on retry", async () => {
    mockedApiGet.mockRejectedValueOnce(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderPanel();

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
    renderPanel();

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
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: 'Delete "Spanish Basics"' }));

    expect(mockedApiDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Spanish Basics" })).toBeInTheDocument();
  });

  it("opens a set via ?set=<id> and returns focus to its card on the list", async () => {
    serve([spanish, french]);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "French Basics" }));

    expect(currentSearch()).toBe("?set=2");
    expect(screen.getByRole("heading", { level: 2, name: "French Basics" })).toHaveFocus();
    expect(screen.getByDisplayValue("French Basics")).toBeInTheDocument();
    expect(await screen.findByText("No terms yet. Add your first term below.")).toBeInTheDocument();
    expect(mockedApiGet).toHaveBeenCalledWith("/api/study-sets/2/terms", expect.any(AbortSignal));

    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));

    expect(currentSearch()).toBe("");
    expect(screen.getByRole("button", { name: "French Basics" })).toHaveFocus();
  });

  it("restores the editor directly from ?set=<id>", async () => {
    serve([spanish, french]);
    renderPanel("/?set=2");

    expect(await screen.findByRole("heading", { level: 2, name: "French Basics" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("French Basics")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Spanish Basics" })).not.toBeInTheDocument();
  });

  it("restores the create form directly from ?set=new and cancelling returns to the list", async () => {
    serve([spanish]);
    renderPanel("/?set=new");

    expect(await screen.findByRole("heading", { name: "Create study set" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(currentSearch()).toBe("");
    expect(screen.queryByRole("heading", { name: "Create study set" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your study sets" })).toHaveFocus();
  });

  it("opens the new set's editor after creating it and focuses its card on return", async () => {
    serve([spanish]);
    const created: StudySet = { ...spanish, id: 9, title: "Biology", termCount: 0 };
    mockedApiPost.mockResolvedValue(created);
    renderPanel("/?set=new");

    fireEvent.change(await screen.findByLabelText(/Title/), { target: { value: "Biology" } });
    fireEvent.click(screen.getByRole("button", { name: /Create/ }));

    await waitFor(() => expect(currentSearch()).toBe("?set=9"));
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "Biology" })).toHaveFocus(),
    );
    expect(screen.getByDisplayValue("Biology")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));
    expect(screen.getByRole("button", { name: "Biology" })).toHaveFocus();
  });

  it.each(["999", "abc"])("shows a recoverable not-found state for ?set=%s", async (param) => {
    serve([spanish]);
    renderPanel(`/?set=${param}`);

    expect(await screen.findByRole("heading", { name: "Study set not found" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));

    expect(currentSearch()).toBe("");
    expect(screen.getByRole("button", { name: "Spanish Basics" })).toBeInTheDocument();
  });

  it("keeps other query parameters such as ?demo=true", async () => {
    serve([spanish]);
    renderPanel("/?demo=true");

    fireEvent.click(await screen.findByRole("button", { name: "Spanish Basics" }));
    expect(currentSearch()).toBe("?demo=true&set=1");

    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));
    expect(currentSearch()).toBe("?demo=true");
  });

  it("waits for an in-flight save before leaving the editor and updates the card", async () => {
    serve([spanish]);
    let resolveSave!: (studySet: StudySet) => void;
    mockedApiPatch.mockReturnValueOnce(new Promise((resolve) => (resolveSave = resolve)));
    const confirm = vi.spyOn(window, "confirm");
    renderPanel("/?set=1");

    const title = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "Spanish 101" } });
    // Clicking Back blurs the field first, which starts the save.
    fireEvent.blur(title);
    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));

    expect(currentSearch()).toBe("?set=1");
    await act(async () => resolveSave({ ...spanish, title: "Spanish 101" }));

    expect(currentSearch()).toBe("");
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Spanish 101" })).toHaveFocus();
  });

  it("stays in the editor when the save fails and discards the edits after confirming", async () => {
    serve([spanish]);
    mockedApiPatch.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPanel("/?set=1");

    const title = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "Spanish 101" } });
    fireEvent.blur(title);
    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));

    expect(await screen.findByText("Server unavailable")).toBeInTheDocument();
    expect(currentSearch()).toBe("?set=1");
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(currentSearch()).toBe("?set=1");
    expect(title).toHaveValue("Spanish 101");

    expect(confirm).toHaveBeenLastCalledWith(
      "Your latest changes to this study set haven't been saved. Discard them and leave?",
    );

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));
    expect(currentSearch()).toBe("");

    // Discarded means discarded: nothing is saved in the background and the set is unchanged.
    await act(async () => {});
    expect(mockedApiPatch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Spanish Basics" })).toBeInTheDocument();
  });

  it("does not let a pending Back from one editor close the next editor", async () => {
    serve([spanish, french]);
    let resolveSave!: (studySet: StudySet) => void;
    mockedApiPatch.mockReturnValueOnce(new Promise((resolve) => (resolveSave = resolve)));
    renderPanel("/");

    fireEvent.click(await screen.findByRole("button", { name: "Spanish Basics" }));
    const title = screen.getByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "Spanish 101" } });
    fireEvent.blur(title);
    // Back waits for the running save...
    fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));
    expect(currentSearch()).toBe("?set=1");
    // ...but the user navigates away with the browser before it finishes.
    fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
    expect(currentSearch()).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "French Basics" }));
    expect(currentSearch()).toBe("?set=2");
    await act(async () => resolveSave({ ...spanish, title: "Spanish 101" }));

    expect(currentSearch()).toBe("?set=2");
    expect(screen.getByRole("heading", { level: 2, name: "French Basics" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("French Basics")).toBeInTheDocument();
  });

  it("asks before logging out with unsaved details and then doesn't save them", async () => {
    serve([spanish]);
    mockedApiPatch.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const panel = createRef<StudySetsPanelHandle>();
    const { unmount } = renderPanel("/?set=1", panel);

    expect(panel.current!.confirmLeave("Log out")).toBe(true); // nothing unsaved yet
    expect(confirm).not.toHaveBeenCalled();

    const title = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.change(title, { target: { value: "Spanish 101" } });
    fireEvent.blur(title);
    await screen.findByText("Server unavailable");

    expect(panel.current!.confirmLeave("Log out")).toBe(false);
    expect(confirm).toHaveBeenLastCalledWith(
      "Your latest changes to this study set haven't been saved. Discard them and log out?",
    );

    confirm.mockReturnValue(true);
    expect(panel.current!.confirmLeave("Log out")).toBe(true);
    unmount(); // what logging out does to the page
    expect(mockedApiPatch).toHaveBeenCalledTimes(1);
  });

  it("leaves without asking when nothing changed", async () => {
    serve([spanish]);
    const confirm = vi.spyOn(window, "confirm");
    renderPanel("/?set=1");

    fireEvent.click(await screen.findByRole("button", { name: "Back to study sets" }));

    expect(currentSearch()).toBe("");
    expect(confirm).not.toHaveBeenCalled();
    expect(mockedApiPatch).not.toHaveBeenCalled();
  });

  describe("study modes", () => {
    const terms = [
      { id: 1, term: "hola", definition: "hello", orderIndex: 0 },
      { id: 2, term: "adiós", definition: "goodbye", orderIndex: 1 },
    ];
    const serveWithTerms = (studySets: StudySet[]) =>
      mockedApiGet.mockImplementation(async (path: string) =>
        path === "/api/study-sets" ? studySets : terms,
      );

    it("starts a mode from the set page via ?study= and returns to it", async () => {
      serveWithTerms([spanish]);
      renderPanel("/?set=1");

      fireEvent.click(await screen.findByRole("button", { name: /^Flashcards/ }));

      expect(currentSearch()).toBe("?set=1&study=flashcards");
      expect(screen.getByRole("heading", { level: 2, name: "Spanish Basics" })).toHaveFocus();
      expect(await screen.findByText("Card 1 / 2")).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();

      fireEvent.click(within(screen.getByRole("navigation", { name: "Study mode" })).getByRole("button", { name: "Written" }));
      expect(currentSearch()).toBe("?set=1&study=written");
      expect(await screen.findByRole("textbox", { name: "Your answer" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Back to set" }));
      expect(currentSearch()).toBe("?set=1");
      expect(screen.getByRole("button", { name: /^Written/ })).toHaveFocus();
      expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    });

    it("restores a study session directly from the URL and ignores unknown modes", async () => {
      serveWithTerms([spanish]);
      // Keep the question order fixed; StudySession uses Math.random for shuffling.
      vi.spyOn(Math, "random").mockReturnValue(0.9999999);
      const { unmount } = renderPanel("/?set=1&study=multiple-choice");
      expect(await screen.findByRole("heading", { name: "hola" })).toBeInTheDocument();
      expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
      unmount();

      renderPanel("/?set=1&study=bogus");
      expect(await screen.findByRole("textbox", { name: "Title" })).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Study mode" })).not.toBeInTheDocument();
    });

    it("disables modes the set doesn't have enough terms for", async () => {
      // The term editor syncs the count from the loaded terms, so serve exactly one.
      mockedApiGet.mockImplementation(async (path: string) =>
        path === "/api/study-sets" ? [{ ...spanish, termCount: 1 }] : terms.slice(0, 1),
      );
      renderPanel("/?set=1");

      expect(await screen.findByDisplayValue("hola")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Flashcards/ })).toBeEnabled();
      expect(screen.getByRole("button", { name: /^Multiple choice/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^Multiple choice/ })).toHaveAccessibleDescription(
        "Add at least 2 terms to use this mode.",
      );
    });

    it("waits for a running save before starting a mode", async () => {
      serveWithTerms([spanish]);
      let resolveSave!: (studySet: StudySet) => void;
      mockedApiPatch.mockReturnValueOnce(new Promise((resolve) => (resolveSave = resolve)));
      renderPanel("/?set=1");

      const title = await screen.findByRole("textbox", { name: "Title" });
      fireEvent.change(title, { target: { value: "Spanish 101" } });
      fireEvent.blur(title);
      fireEvent.click(screen.getByRole("button", { name: /^Flashcards/ }));
      expect(currentSearch()).toBe("?set=1");

      await act(async () => resolveSave({ ...spanish, title: "Spanish 101" }));
      expect(currentSearch()).toBe("?set=1&study=flashcards");
      expect(screen.getByRole("heading", { level: 2, name: "Spanish 101" })).toBeInTheDocument();
    });

    it("asks before leaving with a failed term save and then discards it", async () => {
      serveWithTerms([spanish]);
      mockedApiPatch.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
      renderPanel("/?set=1");

      const term = await screen.findByRole("textbox", { name: "Term 1" });
      fireEvent.change(term, { target: { value: "buenas" } });
      fireEvent.blur(term, { relatedTarget: screen.getByRole("button", { name: "Back to study sets" }) });
      fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));

      // The save was still running when Back was clicked; it failed, so we stayed.
      expect(await screen.findByText("Server unavailable")).toBeInTheDocument();
      expect(currentSearch()).toBe("?set=1");

      fireEvent.click(screen.getByRole("button", { name: "Back to study sets" }));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(currentSearch()).toBe("");
      await act(async () => {});
      expect(mockedApiPatch).toHaveBeenCalledTimes(1);
    });
  });
});
