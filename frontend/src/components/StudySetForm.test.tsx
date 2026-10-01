import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import StudySetForm from "./StudySetForm";
import { apiPatch, apiPost, ApiError } from "../api/client";
import type { StudySet } from "../api/types";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, apiPost: vi.fn(), apiPatch: vi.fn() };
});

const mockedApiPost = vi.mocked(apiPost);
const mockedApiPatch = vi.mocked(apiPatch);

const spanish: StudySet = {
  id: 1,
  title: "Spanish Basics",
  description: "Greetings",
  termCount: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const title = () => screen.getByRole("textbox", { name: "Title" });
const description = () => screen.getByRole("textbox", { name: "Description (optional)" });
const saveStatus = () => screen.getByRole("status");

function edit(field: HTMLElement, value: string) {
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockedApiPost.mockReset();
  mockedApiPatch.mockReset();
  // Unmounting with unsaved changes saves them, so give leftover saves something to resolve.
  mockedApiPatch.mockResolvedValue(spanish);
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("StudySetForm (editing an existing set)", () => {
  it("labels its fields and applies the backend's length limits", () => {
    render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    expect(title()).toHaveValue("Spanish Basics");
    expect(title()).toHaveAttribute("maxlength", "200");
    expect(description()).toHaveValue("Greetings");
    expect(description()).toHaveAttribute("maxlength", "1000");
    expect(saveStatus()).toHaveTextContent("Saved");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("saves a changed field when it loses focus and reports Saving… then Saved", async () => {
    const request = deferred<StudySet>();
    mockedApiPatch.mockReturnValueOnce(request.promise);
    const onSaved = vi.fn();
    const onStatusChange = vi.fn();
    render(<StudySetForm studySet={spanish} onSaved={onSaved} onStatusChange={onStatusChange} />);

    fireEvent.change(title(), { target: { value: "Spanish 101" } });
    expect(saveStatus()).toHaveTextContent("Unsaved changes");
    expect(mockedApiPatch).not.toHaveBeenCalled();

    fireEvent.blur(title());
    expect(saveStatus()).toHaveTextContent("Saving…");
    expect(mockedApiPatch).toHaveBeenCalledWith("/api/study-sets/1", {
      title: "Spanish 101",
      description: "Greetings",
    });

    const updated = { ...spanish, title: "Spanish 101" };
    await act(async () => request.resolve(updated));

    expect(saveStatus()).toHaveTextContent("Saved");
    expect(onSaved).toHaveBeenCalledWith(updated);
    expect(onStatusChange.mock.calls.map(([status]) => status)).toEqual([
      "saved",
      "unsaved",
      "saving",
      "saved",
    ]);
  });

  it("does not send a request when a field loses focus unchanged", () => {
    render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    fireEvent.focus(title());
    fireEvent.blur(title());
    edit(description(), "Greetings");

    expect(mockedApiPatch).not.toHaveBeenCalled();
    expect(saveStatus()).toHaveTextContent("Saved");
  });

  it("treats whitespace-only edits as unchanged and trims what it sends", async () => {
    mockedApiPatch.mockResolvedValueOnce({ ...spanish, description: "Hello and goodbye" });
    render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    fireEvent.change(title(), { target: { value: "  Spanish Basics  " } });
    expect(saveStatus()).toHaveTextContent("Saved");
    fireEvent.blur(title());
    expect(mockedApiPatch).not.toHaveBeenCalled();
    expect(title()).toHaveValue("Spanish Basics");

    edit(description(), "  Hello and goodbye ");

    expect(mockedApiPatch).toHaveBeenCalledWith("/api/study-sets/1", {
      title: "Spanish Basics",
      description: "Hello and goodbye",
    });
    await waitFor(() => expect(description()).toHaveValue("Hello and goodbye"));
    expect(saveStatus()).toHaveTextContent("Saved");
  });

  it("shows an inline error for an empty title and does not save", () => {
    render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    edit(title(), "   ");

    expect(mockedApiPatch).not.toHaveBeenCalled();
    expect(title()).toHaveAttribute("aria-invalid", "true");
    expect(title()).toHaveAccessibleDescription("Title is required");
    expect(saveStatus()).toHaveTextContent("Couldn't save");

    fireEvent.change(title(), { target: { value: "Spanish Basics" } });
    expect(title()).not.toHaveAttribute("aria-invalid");
    expect(saveStatus()).toHaveTextContent("Saved");
  });

  it("keeps the entered values when saving fails and saves again on Retry", async () => {
    mockedApiPatch.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
    render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    edit(title(), "Spanish 101");

    expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
    expect(saveStatus()).toHaveTextContent("Couldn't save");
    expect(title()).toHaveValue("Spanish 101");

    mockedApiPatch.mockResolvedValueOnce({ ...spanish, title: "Spanish 101" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(saveStatus()).toHaveTextContent("Saved"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockedApiPatch).toHaveBeenCalledTimes(2);
  });

  it("shows backend field errors next to the field instead of 'Validation failed'", async () => {
    mockedApiPatch.mockRejectedValueOnce(
      new ApiError(400, "Validation failed", { description: "Description must be at most 1000 characters" }),
    );
    render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    edit(description(), "Longer description");

    await waitFor(() =>
      expect(description()).toHaveAccessibleDescription("Description must be at most 1000 characters"),
    );
    expect(screen.queryByText("Validation failed")).not.toBeInTheDocument();
    expect(description()).toHaveValue("Longer description");
  });

  it("saves edits made while an earlier save was in flight", async () => {
    const first = deferred<StudySet>();
    mockedApiPatch.mockReturnValueOnce(first.promise);
    mockedApiPatch.mockResolvedValueOnce({ ...spanish, title: "Spanish 101", description: "Hi" });
    render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    edit(title(), "Spanish 101");
    edit(description(), "Hi");
    expect(mockedApiPatch).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve({ ...spanish, title: "Spanish 101" }));

    await waitFor(() => expect(mockedApiPatch).toHaveBeenCalledTimes(2));
    expect(mockedApiPatch).toHaveBeenLastCalledWith("/api/study-sets/1", {
      title: "Spanish 101",
      description: "Hi",
    });
    expect(description()).toHaveValue("Hi");
    await waitFor(() => expect(saveStatus()).toHaveTextContent("Saved"));
  });

  it("warns before unloading the page only while there are unsaved changes", () => {
    render(<StudySetForm studySet={spanish} onSaved={() => {}} />);
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(unload()).toBe(false);
    fireEvent.change(title(), { target: { value: "Spanish 101" } });
    expect(unload()).toBe(true);
  });

  it("saves valid pending changes when unmounted without a blur", () => {
    mockedApiPatch.mockResolvedValueOnce({ ...spanish, title: "Spanish 101" });
    const { unmount } = render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    fireEvent.change(title(), { target: { value: "Spanish 101" } });
    unmount();

    expect(mockedApiPatch).toHaveBeenCalledWith("/api/study-sets/1", {
      title: "Spanish 101",
      description: "Greetings",
    });
  });

  it("does not send a second request when unmounted during a save with no newer edits", async () => {
    const request = deferred<StudySet>();
    mockedApiPatch.mockReturnValueOnce(request.promise);
    const { unmount } = render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    edit(title(), "Spanish 101");
    unmount();
    await act(async () => request.resolve({ ...spanish, title: "Spanish 101" }));

    expect(mockedApiPatch).toHaveBeenCalledTimes(1);
  });

  it("saves newer edits once the running save finishes when unmounted mid-save", async () => {
    const request = deferred<StudySet>();
    mockedApiPatch.mockReturnValueOnce(request.promise);
    const onSaved = vi.fn();
    const { unmount } = render(<StudySetForm studySet={spanish} onSaved={onSaved} />);

    edit(title(), "Spanish 101");
    fireEvent.change(description(), { target: { value: "Hi" } });
    unmount();
    // Nothing overlaps: the newer values wait for the running request.
    expect(mockedApiPatch).toHaveBeenCalledTimes(1);

    await act(async () => request.resolve({ ...spanish, title: "Spanish 101" }));

    await waitFor(() => expect(mockedApiPatch).toHaveBeenCalledTimes(2));
    expect(mockedApiPatch).toHaveBeenLastCalledWith("/api/study-sets/1", {
      title: "Spanish 101",
      description: "Hi",
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
  });

  it("retries the latest values once after unmounting if the running save fails", async () => {
    const request = deferred<StudySet>();
    mockedApiPatch.mockReturnValueOnce(request.promise);
    mockedApiPatch.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
    const onSaved = vi.fn();
    const { unmount } = render(<StudySetForm studySet={spanish} onSaved={onSaved} />);

    edit(title(), "Spanish 101");
    fireEvent.change(description(), { target: { value: "Hi" } });
    unmount();
    await act(async () => request.reject(new ApiError(500, "Server unavailable")));

    await waitFor(() => expect(mockedApiPatch).toHaveBeenCalledTimes(2));
    expect(mockedApiPatch).toHaveBeenLastCalledWith("/api/study-sets/1", {
      title: "Spanish 101",
      description: "Hi",
    });
    // Both attempts failed: nothing is reported as saved and there's no endless retrying.
    await act(async () => {});
    expect(mockedApiPatch).toHaveBeenCalledTimes(2);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("keeps a failed save visible instead of auto-sending queued edits while mounted", async () => {
    const request = deferred<StudySet>();
    mockedApiPatch.mockReturnValueOnce(request.promise);
    render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    edit(title(), "Spanish 101");
    edit(description(), "Hi");
    await act(async () => request.reject(new ApiError(500, "Server unavailable")));

    expect(mockedApiPatch).toHaveBeenCalledTimes(1);
    expect(saveStatus()).toHaveTextContent("Couldn't save");
    expect(screen.getByRole("alert")).toHaveTextContent("Server unavailable");
    expect(title()).toHaveValue("Spanish 101");
    expect(description()).toHaveValue("Hi");
  });

  it("does not save on unmount, nor send queued edits, once the changes were discarded", async () => {
    const request = deferred<StudySet>();
    mockedApiPatch.mockReturnValueOnce(request.promise);
    const { unmount } = render(
      <StudySetForm studySet={spanish} onSaved={() => {}} isDiscarded={() => true} />,
    );

    edit(title(), "Spanish 101");
    fireEvent.change(description(), { target: { value: "Hi" } });
    unmount();
    await act(async () => request.resolve({ ...spanish, title: "Spanish 101" }));

    expect(mockedApiPatch).toHaveBeenCalledTimes(1);
  });

  it("clears the error and Retry when the user reverts to the saved values", async () => {
    mockedApiPatch.mockRejectedValueOnce(new ApiError(500, "Server unavailable"));
    render(<StudySetForm studySet={spanish} onSaved={() => {}} />);

    edit(title(), "Spanish 101");
    expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");

    fireEvent.change(title(), { target: { value: "Spanish Basics" } });
    expect(saveStatus()).toHaveTextContent("Saved");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

    fireEvent.blur(title());
    fireEvent.change(title(), { target: { value: "Spanish 102" } });
    // The old failure was cleared, so a new edit is just unsaved, not an error.
    expect(saveStatus()).toHaveTextContent("Unsaved changes");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockedApiPatch).toHaveBeenCalledTimes(1);
  });
});

describe("StudySetForm (creating a new set)", () => {
  it("does not create anything when a field loses focus", () => {
    render(<StudySetForm onSaved={() => {}} />);

    edit(title(), "Biology");
    edit(description(), "Cells");

    expect(mockedApiPost).not.toHaveBeenCalled();
    expect(mockedApiPatch).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("creates the set with trimmed values on an explicit submit", async () => {
    const created = { ...spanish, id: 9, title: "Biology", description: null };
    mockedApiPost.mockResolvedValueOnce(created);
    const onSaved = vi.fn();
    render(<StudySetForm onSaved={onSaved} />);

    fireEvent.change(title(), { target: { value: " Biology " } });
    fireEvent.click(screen.getByRole("button", { name: "Create study set" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
    expect(mockedApiPost).toHaveBeenCalledWith("/api/study-sets", { title: "Biology", description: "" });
  });

  it("requires a title and shows backend field errors inline", async () => {
    mockedApiPost.mockRejectedValueOnce(
      new ApiError(400, "Validation failed", { title: "Title must be at most 200 characters" }),
    );
    render(<StudySetForm onSaved={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Create study set" }));
    expect(title()).toHaveAccessibleDescription("Title is required");
    expect(mockedApiPost).not.toHaveBeenCalled();

    fireEvent.change(title(), { target: { value: "Biology" } });
    fireEvent.click(screen.getByRole("button", { name: "Create study set" }));

    await waitFor(() =>
      expect(title()).toHaveAccessibleDescription("Title must be at most 200 characters"),
    );
    expect(screen.queryByText("Validation failed")).not.toBeInTheDocument();
    expect(title()).toHaveValue("Biology");
  });

  it("asks before cancelling with entered content", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onCancel = vi.fn();
    render(<StudySetForm onSaved={() => {}} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.change(title(), { target: { value: "Biology" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledWith("Discard this new study set?");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
