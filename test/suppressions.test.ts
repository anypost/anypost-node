import { describe, expect, test } from "bun:test";
import { Anypost, NotFoundError } from "../src/index.js";
import { mockFetch } from "./helpers.js";

function suppression(overrides: Record<string, unknown> = {}) {
  return {
    id: "sup_1",
    email: "alice@example.com",
    topic: "*",
    reason: "manual",
    origin: "manual",
    classification: null,
    smtp_code: null,
    note: null,
    suppressed_at: "2026-04-30T12:00:00.0Z",
    expires_at: null,
    created_at: "2026-04-30T12:00:00.0Z",
    ...overrides,
  };
}

function queryOf(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("suppressions", () => {
  test("create posts the body", async () => {
    const m = mockFetch([{ status: 201, body: suppression({ topic: "marketing", reason: "unsubscribed" }) }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const s = await anypost.suppressions.create({ email: "alice@example.com", topic: "marketing" });

    expect(s.topic).toBe("marketing");
    const req = m.calls[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.anypost.com/v1/suppressions");
    expect(req.body).toEqual({ email: "alice@example.com", topic: "marketing" });
  });

  test("createBatch wraps the entries and returns the outcome counts", async () => {
    const m = mockFetch([
      {
        status: 200,
        body: { imported: 1, already_suppressed: 0, invalid: [{ index: 1, email: "not-an-address" }] },
      },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const result = await anypost.suppressions.createBatch([
      { email: "alice@example.com", topic: "marketing", reason: "hard bounce" },
      { email: "not-an-address" },
    ]);

    expect(result.imported).toBe(1);
    expect(result.invalid).toEqual([{ index: 1, email: "not-an-address" }]);
    const req = m.calls[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.anypost.com/v1/suppressions/batch");
    expect(req.body).toEqual({
      suppressions: [
        { email: "alice@example.com", topic: "marketing", reason: "hard bounce" },
        { email: "not-an-address" },
      ],
    });
  });

  test("list passes filters as query params", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [suppression()], has_more: false, next_cursor: null } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.suppressions.list({
      limit: 50,
      email_contains: "example.com",
      reason: "complaint",
      origin: "auto",
    });

    const q = queryOf(m.calls[0]!.url);
    expect(q.get("limit")).toBe("50");
    expect(q.get("email_contains")).toBe("example.com");
    expect(q.get("reason")).toBe("complaint");
    expect(q.get("origin")).toBe("auto");
  });

  test("list carries filters onto the next page", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [suppression({ id: "sup_1" })], has_more: true, next_cursor: "CUR2" } },
      { status: 200, body: { data: [suppression({ id: "sup_2" })], has_more: false, next_cursor: null } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const seen: string[] = [];
    for await (const s of await anypost.suppressions.list({ reason: "manual" })) {
      seen.push(s.id);
    }

    expect(seen).toEqual(["sup_1", "sup_2"]);
    const q = queryOf(m.calls[1]!.url);
    expect(q.get("after")).toBe("CUR2");
    expect(q.get("reason")).toBe("manual");
  });

  test("get encodes email and topic into the path", async () => {
    const m = mockFetch([{ status: 200, body: suppression({ topic: "*" }) }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.suppressions.get("alice@example.com", "*");

    // encodeURIComponent leaves `*` literal; the API accepts it in path segments.
    expect(m.calls[0]!.url).toBe(
      "https://api.anypost.com/v1/suppressions/alice%40example.com/*",
    );
  });

  test("delete by email and topic resolves void on 204", async () => {
    const m = mockFetch([{ status: 204 }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    expect(await anypost.suppressions.delete("alice@example.com", "marketing")).toBeUndefined();
    const req = m.calls[0]!;
    expect(req.method).toBe("DELETE");
    expect(req.url).toBe(
      "https://api.anypost.com/v1/suppressions/alice%40example.com/marketing",
    );
  });

  test("listForEmail unwraps the data array", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [suppression({ topic: "*" }), suppression({ id: "sup_2", topic: "marketing" })] } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const rows = await anypost.suppressions.listForEmail("alice@example.com");

    expect(rows.map((r) => r.topic)).toEqual(["*", "marketing"]);
    expect(m.calls[0]!.url).toBe(
      "https://api.anypost.com/v1/suppressions/alice%40example.com",
    );
  });

  test("listForEmail throws NotFoundError when nothing is suppressed", async () => {
    const m = mockFetch([
      { status: 404, body: { error: { type: "not_found", message: "No suppressions." } } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await expect(
      anypost.suppressions.listForEmail("bob@example.com"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
