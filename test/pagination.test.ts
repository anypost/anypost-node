import { describe, expect, test } from "bun:test";
import { Anypost } from "../src/index.js";
import { mockFetch, type RecordedRequest } from "./helpers.js";

function dom(id: string) {
  return {
    id,
    name: `${id}.com`,
    status: "verified",
    dns_records: [],
    verification_failure: null,
    tracking: {
      opens_enabled: false,
      clicks_enabled: false,
      subdomain: null,
      dns_records: [],
      status: "disabled",
      verification_failure: null,
      verified_at: null,
    },
    created_at: "2026-04-30T12:00:00.0Z",
    verified_at: "2026-04-30T12:00:00.0Z",
  };
}

function queryOf(req: RecordedRequest): URLSearchParams {
  return new URL(req.url).searchParams;
}

describe("pagination", () => {
  test("list returns one page and exposes the wire envelope", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [dom("a"), dom("b")], has_more: true, next_cursor: "CUR2" } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const page = await anypost.domains.list({ limit: 2 });

    expect(page.data.map((d) => d.id)).toEqual(["a", "b"]);
    expect(page.has_more).toBe(true);
    expect(page.next_cursor).toBe("CUR2");
    expect(queryOf(m.calls[0]!).get("limit")).toBe("2");
    expect(queryOf(m.calls[0]!).get("after")).toBeNull();
  });

  test("for-await walks every page until has_more is false", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [dom("a"), dom("b")], has_more: true, next_cursor: "CUR2" } },
      { status: 200, body: { data: [dom("c")], has_more: true, next_cursor: "CUR3" } },
      { status: 200, body: { data: [dom("d")], has_more: false, next_cursor: null } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const seen: string[] = [];
    for await (const d of await anypost.domains.list()) {
      seen.push(d.id);
    }

    expect(seen).toEqual(["a", "b", "c", "d"]);
    expect(m.calls).toHaveLength(3);
    // Subsequent pages carry the prior page's cursor as `after`.
    expect(queryOf(m.calls[1]!).get("after")).toBe("CUR2");
    expect(queryOf(m.calls[2]!).get("after")).toBe("CUR3");
  });

  test("getNextPage returns null on the last page", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [dom("a")], has_more: false, next_cursor: null } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const page = await anypost.domains.list();

    expect(await page.getNextPage()).toBeNull();
    expect(m.calls).toHaveLength(1);
  });
});
