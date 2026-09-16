import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateQuizForm from "./CreateQuizForm";
import { apiPost, ApiError } from "../api/client";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {
    ...actual,
    apiPost: vi.fn(),
  };
});

const mockedApiPost = vi.mocked(apiPost);

beforeEach(() => {
  mockedApiPost.mockReset();
});

describe("CreateQuizForm", () => {
  it("preserves the entered title and description and shows an error when the save fails", async () => {
    mockedApiPost.mockRejectedValue(new ApiError(500, "Failed to create quiz"));
    const onQuizCreated = vi.fn();

    render(<CreateQuizForm onCancel={() => {}} onQuizCreated={onQuizCreated} />);

    fireEvent.change(screen.getByPlaceholderText("Quiz title"), {
      target: { value: "My Quiz Title" },
    });
    fireEvent.change(screen.getByPlaceholderText("Quiz description"), {
      target: { value: "My quiz description" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create quiz" }));

    await waitFor(() => expect(screen.getByText("Failed to create quiz")).toBeInTheDocument());

    // Input must be preserved so the user doesn't have to retype it.
    expect(screen.getByPlaceholderText("Quiz title")).toHaveValue("My Quiz Title");
    expect(screen.getByPlaceholderText("Quiz description")).toHaveValue("My quiz description");

    // The form must not have been cleared/submitted successfully.
    expect(onQuizCreated).not.toHaveBeenCalled();

    // The submit button must be re-enabled after the failed attempt.
    expect(screen.getByRole("button", { name: "Create quiz" })).not.toBeDisabled();
  });

  it("disables the submit button while the request is pending", async () => {
    let resolveRequest!: (value: { id: number; title: string; description: string }) => void;
    mockedApiPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(<CreateQuizForm onCancel={() => {}} onQuizCreated={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText("Quiz title"), {
      target: { value: "Title" },
    });
    fireEvent.change(screen.getByPlaceholderText("Quiz description"), {
      target: { value: "Description" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create quiz" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled(),
    );

    resolveRequest({ id: 1, title: "Title", description: "Description" });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create quiz" })).toBeInTheDocument(),
    );
  });

  it("clears the form only after a successful save", async () => {
    mockedApiPost.mockResolvedValue({ id: 1, title: "Title", description: "Description" });
    const onQuizCreated = vi.fn();

    render(<CreateQuizForm onCancel={() => {}} onQuizCreated={onQuizCreated} />);

    fireEvent.change(screen.getByPlaceholderText("Quiz title"), {
      target: { value: "Title" },
    });
    fireEvent.change(screen.getByPlaceholderText("Quiz description"), {
      target: { value: "Description" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create quiz" }));

    await waitFor(() => expect(onQuizCreated).toHaveBeenCalledTimes(1));
    expect(screen.getByPlaceholderText("Quiz title")).toHaveValue("");
    expect(screen.getByPlaceholderText("Quiz description")).toHaveValue("");
  });
});
