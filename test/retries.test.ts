import { describe, expect, test } from "bun:test";
import { Anypost, APIError, APIConnectionError } from "../src/index.js";
import { mockFetch, type ResponseSpec } from "./helpers.js";

const SEND = { from: "a@x.com", to: ["b@x.com"], subject: "s", text: "t" };
const OK: ResponseSpec = {
  status: 202,
  body: { id: "email_1", created_at: "x" },
};
// Retry-After: 0 keeps the backoff instant so tests stay fast.
const fast = (status: number): ResponseSpec => ({
  status,
  body: { error: { type: "internal_error", message: "retry" } },
  headers: { "Retry-After": "0" },
});

describe("retries", () => {
  test("retries a 503 then succeeds, reusing one Idempotency-Key", async () => {
    const m = mockFetch([fast(503), OK]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch, maxRetries: 2 });

    const res = await anypost.email.send(SEND);

    expect(res.id).toBe("email_1");
    expect(m.calls).toHaveLength(2);
    expect(m.calls[0]!.headers["idempotency-key"]).toBe(
      m.calls[1]!.headers["idempotency-key"],
    );
  });

  test("exhausts retries on repeated 502 and throws APIError", async () => {
    const m = mockFetch([fast(502), fast(502)]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch, maxRetries: 1 });

    await expect(anypost.email.send(SEND)).rejects.toBeInstanceOf(APIError);
    expect(m.calls).toHaveLength(2);
  });

  test("retries a network failure then succeeds", async () => {
    const m = mockFetch([
      { status: 0, throwError: new TypeError("network down") },
      OK,
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch, maxRetries: 1 });

    const res = await anypost.email.send(SEND);

    expect(res.id).toBe("email_1");
    expect(m.calls).toHaveLength(2);
  });

  test("a persistent network failure throws APIConnectionError", async () => {
    const m = mockFetch([{ status: 0, throwError: new TypeError("down") }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch, maxRetries: 0 });
    await expect(anypost.whoami()).rejects.toBeInstanceOf(APIConnectionError);
  });

  test("does not retry a 400", async () => {
    const m = mockFetch([
      { status: 400, body: { error: { type: "validation_error", message: "no" } } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch, maxRetries: 3 });
    await anypost.email.send(SEND).catch(() => {});
    expect(m.calls).toHaveLength(1);
  });
});
