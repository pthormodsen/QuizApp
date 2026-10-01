import { describe, it, expect, beforeEach } from "vitest";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError, resetDemoData } from "./client";
import type { StudySet, Term } from "./types";

beforeEach(() => {
  window.history.pushState({}, "", "/demo");
  resetDemoData();
});

async function expectApiError(promise: Promise<unknown>, status: number): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(status);
  return error as ApiError;
}

describe("demo mode study sets", () => {
  it("serves seeded study sets with term counts and ordered terms", async () => {
    const sets = await apiGet<StudySet[]>("/api/study-sets");
    expect(sets.length).toBeGreaterThan(0);

    const spanish = sets.find((set) => set.title === "Spanish Basics")!;
    const terms = await apiGet<Term[]>(`/api/study-sets/${spanish.id}/terms`);
    expect(spanish.termCount).toBe(terms.length);
    expect(terms.map((term) => term.orderIndex)).toEqual(terms.map((_, index) => index));
  });

  it("creates, updates and deletes a set and its terms", async () => {
    const created = await apiPost<StudySet>("/api/study-sets", { title: "  Biology  ", description: "" });
    expect(created).toMatchObject({ title: "Biology", description: null, termCount: 0 });

    const cell = await apiPost<Term>(`/api/study-sets/${created.id}/terms`, {
      term: "Cell",
      definition: "Basic unit of life",
    });
    const updated = await apiPatch<Term>(`/api/study-sets/${created.id}/terms/${cell.id}`, {
      term: "Cell",
      definition: "The basic unit of life",
    });
    expect(updated.definition).toBe("The basic unit of life");
    expect((await apiGet<StudySet>(`/api/study-sets/${created.id}`)).termCount).toBe(1);

    await apiDelete(`/api/study-sets/${created.id}`);
    await expectApiError(apiGet(`/api/study-sets/${created.id}`), 404);
    await expectApiError(apiGet(`/api/study-sets/${created.id}/terms`), 404);
  });

  it("validates required fields like the backend", async () => {
    const error = await expectApiError(apiPost("/api/study-sets", { title: " " }), 400);
    expect(error.fieldErrors).toHaveProperty("title");

    const [set] = await apiGet<StudySet[]>("/api/study-sets");
    const termError = await expectApiError(
      apiPost(`/api/study-sets/${set.id}/terms`, { term: "x", definition: "" }),
      400,
    );
    expect(termError.fieldErrors).toHaveProperty("definition");
  });

  it("appends new terms after deletions and reorders deterministically", async () => {
    const set = await apiPost<StudySet>("/api/study-sets", { title: "Order" });
    const path = `/api/study-sets/${set.id}/terms`;
    const a = await apiPost<Term>(path, { term: "a", definition: "1" });
    const b = await apiPost<Term>(path, { term: "b", definition: "2" });
    await apiDelete(`${path}/${a.id}`);
    const c = await apiPost<Term>(path, { term: "c", definition: "3" });

    expect((await apiGet<Term[]>(path)).map((term) => term.id)).toEqual([b.id, c.id]);

    const reordered = await apiPatch<Term[]>(`${path}/reorder`, { termIds: [c.id, b.id] });
    expect(reordered.map((term) => term.id)).toEqual([c.id, b.id]);
    expect((await apiGet<Term[]>(path)).map((term) => term.id)).toEqual([c.id, b.id]);

    await expectApiError(apiPatch(`${path}/reorder`, { termIds: [c.id] }), 400);
  });

  it("returns 404 for terms addressed through the wrong set", async () => {
    const setA = await apiPost<StudySet>("/api/study-sets", { title: "A" });
    const setB = await apiPost<StudySet>("/api/study-sets", { title: "B" });
    const term = await apiPost<Term>(`/api/study-sets/${setA.id}/terms`, { term: "x", definition: "y" });

    await expectApiError(
      apiPatch(`/api/study-sets/${setB.id}/terms/${term.id}`, { term: "x", definition: "z" }),
      404,
    );
    await expectApiError(apiDelete(`/api/study-sets/${setB.id}/terms/${term.id}`), 404);
  });

  it("keeps study sets when a quiz is deleted", async () => {
    const setsBefore = await apiGet<StudySet[]>("/api/study-sets");
    const [quiz] = await apiGet<Array<{ id: number }>>("/api/quizzes");

    await apiDelete(`/api/quizzes/${quiz.id}`);

    expect(await apiGet<StudySet[]>("/api/study-sets")).toEqual(setsBefore);
  });

    it("adds seed study sets to demo sessions saved before study sets existed", async () => {
    sessionStorage.setItem(
      "quizapp_demo_data",
      JSON.stringify({ quizzes: [{ id: 9, title: "Old", description: "d" }], questions: [], answers: [] }),
    );

    expect((await apiGet<StudySet[]>("/api/study-sets")).length).toBeGreaterThan(0);
    expect(await apiGet<Array<{ id: number }>>("/api/quizzes")).toEqual([
      { id: 9, title: "Old", description: "d" },
    ]);
  });
});
