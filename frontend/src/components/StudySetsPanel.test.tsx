import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import StudySetsPanel from "./StudySetsPanel";
import { apiDelete, apiGet, apiPost } from "../api/client";
import type { StudySet } from "../api/types";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, apiGet: vi.fn(), apiPost: vi.fn(), apiDelete: vi.fn() };
});

const mockedApiGet = vi.mocked(apiGet);
const mockedApiPost = vi.mocked(apiPost);
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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="search">{location.search}</output>;
}

function renderPanel(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <StudySetsPanel />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const currentSearch = () => screen.getByTestId("search").textContent;

beforeEach(() => {
  mockedApiGet.mockReset();
  mockedApiPost.mockReset();
  mockedApiDelete.mockReset();
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
    expect(screen.getByRole("heading", { name: "Editing study set" })).toHaveFocus();
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

    expect(await screen.findByRole("heading", { name: "Editing study set" })).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Editing study set" })).toHaveFocus();
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
});
