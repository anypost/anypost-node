import { describe, expect, test } from "bun:test";
import { Anypost } from "../src/index.js";
import { mockFetch } from "./helpers.js";

const WHOAMI = {
  team: { id: "team_1", name: "Acme" },
  api_key: { id: "key_1", permissions: "full" as const },
  limits: { daily: 5000, monthly: 100000, delivery_rate_per_minute: 600 },
};

describe("Anypost client", () => {
  test("sends auth, accept, and user-agent headers", async () => {
    const m = mockFetch([{ status: 200, body: WHOAMI }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const me = await anypost.whoami();

    expect(me).toEqual(WHOAMI);
    const req = m.calls[0]!;
    expect(req.url).toBe("https://api.anypost.com/v1/whoami");
    expect(req.method).toBe("GET");
    expect(req.headers["authorization"]).toBe("Bearer ap_test");
    expect(req.headers["accept"]).toBe("application/json");
    expect(req.headers["user-agent"]).toContain("anypost-node/");
  });

  test("falls back to ANYPOST_API_KEY", async () => {
    process.env.ANYPOST_API_KEY = "ap_env";
    try {
      const m = mockFetch([{ status: 200, body: WHOAMI }]);
      const anypost = new Anypost({ fetch: m.fetch });
      await anypost.whoami();
      expect(m.calls[0]!.headers["authorization"]).toBe("Bearer ap_env");
    } finally {
      delete process.env.ANYPOST_API_KEY;
    }
  });

  test("throws when no API key is available", () => {
    delete process.env.ANYPOST_API_KEY;
    expect(() => new Anypost({ fetch: mockFetch([]).fetch })).toThrow(
      /API key is required/,
    );
  });

  test("normalizes a custom base URL with a trailing slash", async () => {
    const m = mockFetch([{ status: 200, body: WHOAMI }]);
    const anypost = new Anypost("ap_test", {
      baseUrl: "https://gw.example.com/v1/",
      fetch: m.fetch,
    });
    await anypost.whoami();
    expect(m.calls[0]!.url).toBe("https://gw.example.com/v1/whoami");
  });

  test("merges client-level default headers", async () => {
    const m = mockFetch([{ status: 200, body: WHOAMI }]);
    const anypost = new Anypost("ap_test", {
      fetch: m.fetch,
      headers: { "X-App": "demo" },
    });
    await anypost.whoami();
    expect(m.calls[0]!.headers["x-app"]).toBe("demo");
  });
});
