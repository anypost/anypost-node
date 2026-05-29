import { describe, expect, test } from "bun:test";
import { Anypost, ConflictError, NotFoundError } from "../src/index.js";
import { mockFetch } from "./helpers.js";

function webhook(overrides: Record<string, unknown> = {}) {
  return {
    id: "wh_1",
    name: "Production events",
    url: "https://hooks.example.com/anypost",
    events: ["email.delivered", "email.bounced"],
    status: "active",
    signing_secret_prefix: "whsec_AbCdEf",
    signing_secret_previous_prefix: null,
    signing_secret_grace_expires_at: null,
    last_delivery_at: null,
    created_at: "2026-04-30T12:00:00.0Z",
    ...overrides,
  };
}

describe("webhooks", () => {
  test("create posts the body and returns the secret once", async () => {
    const m = mockFetch([
      { status: 201, body: webhook({ signing_secret: "whsec_AbCdEfGhIjKlMnOp" }) },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const created = await anypost.webhooks.create({
      name: "Production events",
      url: "https://hooks.example.com/anypost",
      events: ["email.delivered", "email.bounced"],
    });

    expect(created.signing_secret).toBe("whsec_AbCdEfGhIjKlMnOp");
    const req = m.calls[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.anypost.com/v1/webhooks");
    expect(req.body).toEqual({
      name: "Production events",
      url: "https://hooks.example.com/anypost",
      events: ["email.delivered", "email.bounced"],
    });
    // Management endpoints get no auto idempotency key.
    expect(req.headers["idempotency-key"]).toBeUndefined();
  });

  test("get retrieves a webhook by id", async () => {
    const m = mockFetch([{ status: 200, body: webhook() }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const wh = await anypost.webhooks.get("wh_1");

    expect(wh.id).toBe("wh_1");
    expect(wh.signing_secret_prefix).toBe("whsec_AbCdEf");
    const req = m.calls[0]!;
    expect(req.method).toBe("GET");
    expect(req.url).toBe("https://api.anypost.com/v1/webhooks/wh_1");
  });

  test("update sends a PATCH with the full config", async () => {
    const m = mockFetch([{ status: 200, body: webhook({ status: "disabled" }) }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const updated = await anypost.webhooks.update("wh_1", {
      name: "Production events",
      url: "https://hooks.example.com/anypost",
      events: ["email.delivered"],
      status: "disabled",
    });

    expect(updated.status).toBe("disabled");
    const req = m.calls[0]!;
    expect(req.method).toBe("PATCH");
    expect(req.url).toBe("https://api.anypost.com/v1/webhooks/wh_1");
    expect(req.body).toEqual({
      name: "Production events",
      url: "https://hooks.example.com/anypost",
      events: ["email.delivered"],
      status: "disabled",
    });
  });

  test("delete resolves void on 204", async () => {
    const m = mockFetch([{ status: 204 }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    expect(await anypost.webhooks.delete("wh_1")).toBeUndefined();
    const req = m.calls[0]!;
    expect(req.method).toBe("DELETE");
    expect(req.url).toBe("https://api.anypost.com/v1/webhooks/wh_1");
  });

  test("test posts to /test and returns the outcome", async () => {
    const m = mockFetch([
      {
        status: 200,
        body: {
          delivered: true,
          status_code: 200,
          latency_ms: 142,
          error: null,
          response_body_preview: "ok",
        },
      },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const result = await anypost.webhooks.test("wh_1");

    expect(result.delivered).toBe(true);
    expect(result.status_code).toBe(200);
    const req = m.calls[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.anypost.com/v1/webhooks/wh_1/test");
  });

  test("rotateSecret posts to /rotate-secret and returns the new secret", async () => {
    const m = mockFetch([
      {
        status: 200,
        body: webhook({
          signing_secret: "whsec_NewSecretValue",
          signing_secret_previous_prefix: "whsec_AbCdEf",
          signing_secret_grace_expires_at: "2026-05-01T12:00:00.0Z",
        }),
      },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const rotated = await anypost.webhooks.rotateSecret("wh_1");

    expect(rotated.signing_secret).toBe("whsec_NewSecretValue");
    expect(rotated.signing_secret_previous_prefix).toBe("whsec_AbCdEf");
    expect(m.calls[0]!.url).toBe(
      "https://api.anypost.com/v1/webhooks/wh_1/rotate-secret",
    );
  });

  test("rotateSecret surfaces a 409 as ConflictError during a grace window", async () => {
    const m = mockFetch([
      {
        status: 409,
        body: {
          error: {
            type: "webhook_rotation_in_progress",
            message: "A rotation is already in progress.",
          },
        },
      },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await expect(anypost.webhooks.rotateSecret("wh_1")).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  test("list passes limit and carries the cursor onto the next page", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [webhook({ id: "wh_1" })], has_more: true, next_cursor: "CUR2" } },
      { status: 200, body: { data: [webhook({ id: "wh_2" })], has_more: false, next_cursor: null } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const seen: string[] = [];
    for await (const wh of await anypost.webhooks.list({ limit: 50 })) {
      seen.push(wh.id);
    }

    expect(seen).toEqual(["wh_1", "wh_2"]);
    expect(new URL(m.calls[0]!.url).searchParams.get("limit")).toBe("50");
    expect(new URL(m.calls[1]!.url).searchParams.get("after")).toBe("CUR2");
  });

  test("get surfaces a 404 as NotFoundError", async () => {
    const m = mockFetch([
      { status: 404, body: { error: { type: "not_found", message: "No such webhook." } } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await expect(anypost.webhooks.get("wh_missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
