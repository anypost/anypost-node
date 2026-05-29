import { describe, expect, test } from "bun:test";
import {
  Anypost,
  APIError,
  AuthenticationError,
  ConflictError,
  IdempotencyMismatchError,
  NotFoundError,
  PayloadTooLargeError,
  PermissionError,
  RateLimitError,
  ValidationError,
} from "../src/index.js";
import { mockFetch } from "./helpers.js";

const SEND = { from: "a@x.com", to: ["b@x.com"], subject: "s", text: "t" };

// maxRetries 0 so a retryable status throws immediately instead of looping.
function client(spec: { status: number; body?: unknown; headers?: Record<string, string> }) {
  const m = mockFetch([spec]);
  return new Anypost("ap_test", { fetch: m.fetch, maxRetries: 0 });
}

function canonical(type: string, message = "boom", errors?: unknown) {
  return { error: { type, message, ...(errors ? { errors } : {}) } };
}

describe("error mapping", () => {
  test("validation_error -> ValidationError with field errors", async () => {
    const anypost = client({
      status: 422,
      body: canonical("validation_error", "bad", { from: ["required"] }),
    });
    const err = await anypost.email.send(SEND).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.type).toBe("validation_error");
    expect(err.status).toBe(422);
    expect(err.errors).toEqual({ from: ["required"] });
  });

  test("authentication_error -> AuthenticationError", async () => {
    const anypost = client({ status: 401, body: canonical("authentication_error") });
    await expect(anypost.email.send(SEND)).rejects.toBeInstanceOf(AuthenticationError);
  });

  test("permission_error -> PermissionError", async () => {
    const anypost = client({ status: 403, body: canonical("permission_error") });
    await expect(anypost.email.send(SEND)).rejects.toBeInstanceOf(PermissionError);
  });

  test("not_found -> NotFoundError", async () => {
    const anypost = client({ status: 404, body: canonical("not_found") });
    await expect(anypost.whoami()).rejects.toBeInstanceOf(NotFoundError);
  });

  test("idempotency_concurrent -> ConflictError", async () => {
    const anypost = client({ status: 409, body: canonical("idempotency_concurrent") });
    await expect(anypost.email.send(SEND)).rejects.toBeInstanceOf(ConflictError);
  });

  test("idempotency_mismatch -> IdempotencyMismatchError", async () => {
    const anypost = client({ status: 422, body: canonical("idempotency_mismatch") });
    await expect(anypost.email.send(SEND)).rejects.toBeInstanceOf(
      IdempotencyMismatchError,
    );
  });

  test("rate_limit_exceeded -> RateLimitError with retryAfterMs", async () => {
    const anypost = client({
      status: 429,
      body: canonical("rate_limit_exceeded"),
      headers: { "Retry-After": "2" },
    });
    const err = await anypost.email.send(SEND).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.retryAfterMs).toBe(2000);
  });

  test("flat payload_too_large envelope -> PayloadTooLargeError", async () => {
    const anypost = client({ status: 413, body: { error: "payload_too_large" } });
    const err = await anypost.email.send(SEND).catch((e) => e);
    expect(err).toBeInstanceOf(PayloadTooLargeError);
    expect(err.type).toBe("payload_too_large");
  });

  test("internal_error -> APIError", async () => {
    const anypost = client({ status: 500, body: canonical("internal_error") });
    await expect(anypost.whoami()).rejects.toBeInstanceOf(APIError);
  });

  test("unknown type falls back to the status-derived class", async () => {
    const anypost = client({ status: 404, body: { error: { type: "brand_new" } } });
    const err = await anypost.whoami().catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.type).toBe("brand_new");
  });
});
