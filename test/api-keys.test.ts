import { describe, expect, test } from "bun:test";
import { Anypost, NotFoundError } from "../src/index.js";
import { mockFetch } from "./helpers.js";

function apiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: "key_1",
    name: "Production server",
    key_prefix: "ap_AbCdEf12Kx",
    permissions: "send_only",
    allowed_domains: null,
    allowed_ips: null,
    last_used_at: null,
    created_at: "2026-04-30T12:00:00.0Z",
    ...overrides,
  };
}

describe("apiKeys", () => {
  test("create posts the body and returns the secret once", async () => {
    const m = mockFetch([
      { status: 201, body: { ...apiKey(), key: "ap_AbCdEf12KxLmNoPq" } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const created = await anypost.apiKeys.create({
      name: "Production server",
      permissions: "send_only",
    });

    expect(created.key).toBe("ap_AbCdEf12KxLmNoPq");
    const req = m.calls[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.anypost.com/v1/api-keys");
    expect(req.body).toEqual({ name: "Production server", permissions: "send_only" });
    // management endpoint — no auto idempotency key.
    expect(req.headers["idempotency-key"]).toBeUndefined();
  });

  test("get retrieves by id", async () => {
    const m = mockFetch([{ status: 200, body: apiKey() }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.apiKeys.get("key_1");

    expect(m.calls[0]!.method).toBe("GET");
    expect(m.calls[0]!.url).toBe("https://api.anypost.com/v1/api-keys/key_1");
  });

  test("update PATCHes the new permissions and restrictions", async () => {
    const m = mockFetch([
      { status: 200, body: apiKey({ permissions: "full", allowed_domains: ["example.com"] }) },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.apiKeys.update("key_1", {
      name: "Production server",
      permissions: "full",
      allowed_domains: ["example.com"],
    });

    const req = m.calls[0]!;
    expect(req.method).toBe("PATCH");
    expect(req.body).toEqual({
      name: "Production server",
      permissions: "full",
      allowed_domains: ["example.com"],
    });
  });

  test("delete resolves void on 204", async () => {
    const m = mockFetch([{ status: 204 }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    expect(await anypost.apiKeys.delete("key_1")).toBeUndefined();
    expect(m.calls[0]!.method).toBe("DELETE");
  });

  test("get on a missing key throws NotFoundError", async () => {
    const m = mockFetch([
      { status: 404, body: { error: { type: "not_found", message: "No such key." } } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await expect(anypost.apiKeys.get("key_missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
