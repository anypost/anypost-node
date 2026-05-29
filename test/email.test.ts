import { describe, expect, test } from "bun:test";
import { Anypost } from "../src/index.js";
import { mockFetch } from "./helpers.js";

const SEND = {
  from: "Acme <you@acme.com>",
  to: ["a@example.com"],
  subject: "Hi",
  html: "<p>Hi</p>",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("email.send", () => {
  test("posts the body to /email and returns the queued id", async () => {
    const m = mockFetch([
      { status: 202, body: { id: "email_1", created_at: "2026-04-30T12:00:00.0Z" } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const res = await anypost.email.send(SEND);

    expect(res).toEqual({ id: "email_1", created_at: "2026-04-30T12:00:00.0Z" });
    const req = m.calls[0]!;
    expect(req.url).toBe("https://api.anypost.com/v1/email");
    expect(req.method).toBe("POST");
    expect(req.headers["content-type"]).toBe("application/json");
    expect(req.body).toEqual(SEND);
  });

  test("auto-generates an Idempotency-Key when retries are enabled", async () => {
    const m = mockFetch([{ status: 202, body: { id: "email_1", created_at: "x" } }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });
    await anypost.email.send(SEND);
    expect(m.calls[0]!.headers["idempotency-key"]).toMatch(UUID);
  });

  test("honors an explicit idempotencyKey", async () => {
    const m = mockFetch([{ status: 202, body: { id: "email_1", created_at: "x" } }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });
    await anypost.email.send(SEND, { idempotencyKey: "my-key-123" });
    expect(m.calls[0]!.headers["idempotency-key"]).toBe("my-key-123");
  });

  test("omits the auto key when retries are disabled", async () => {
    const m = mockFetch([{ status: 202, body: { id: "email_1", created_at: "x" } }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch, maxRetries: 0 });
    await anypost.email.send(SEND);
    expect(m.calls[0]!.headers["idempotency-key"]).toBeUndefined();
  });

  test("base64-encodes byte attachments and passes strings through", async () => {
    const m = mockFetch([{ status: 202, body: { id: "email_1", created_at: "x" } }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });
    await anypost.email.send({
      ...SEND,
      attachments: [
        { filename: "bytes.txt", content: new Uint8Array([104, 105]) },
        { filename: "already.txt", content: "YWJj" },
      ],
    });
    const sent = m.calls[0]!.body as { attachments: Array<{ content: string }> };
    expect(sent.attachments[0]!.content).toBe("aGk=");
    expect(sent.attachments[1]!.content).toBe("YWJj");
  });
});

describe("email.sendBatch", () => {
  test("posts to /email/batch", async () => {
    const m = mockFetch([
      {
        status: 202,
        body: {
          summary: { total: 1, queued: 1, failed: 0 },
          data: [{ status: "queued", index: 0, id: "email_1", created_at: "x" }],
        },
      },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });
    const res = await anypost.email.sendBatch({ emails: [SEND] });
    expect(m.calls[0]!.url).toBe("https://api.anypost.com/v1/email/batch");
    expect(res.summary.queued).toBe(1);
  });

  test("base64-encodes byte attachments in defaults", async () => {
    const m = mockFetch([
      {
        status: 202,
        body: {
          summary: { total: 1, queued: 1, failed: 0 },
          data: [{ status: "queued", index: 0, id: "email_1", created_at: "x" }],
        },
      },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });
    await anypost.email.sendBatch({
      defaults: {
        attachments: [{ filename: "shared.txt", content: new Uint8Array([104, 105]) }],
      },
      emails: [SEND],
    });
    const sent = m.calls[0]!.body as {
      defaults: { attachments: Array<{ content: string }> };
    };
    expect(sent.defaults.attachments[0]!.content).toBe("aGk=");
  });

  test("a 207 mixed-outcome batch resolves and does not throw", async () => {
    const m = mockFetch([
      {
        status: 207,
        body: {
          summary: { total: 2, queued: 1, failed: 1 },
          data: [
            { status: "queued", index: 0, id: "email_1", created_at: "x" },
            {
              status: "failed",
              index: 1,
              error: { type: "validation_error", message: "bad" },
            },
          ],
        },
      },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const res = await anypost.email.sendBatch({ emails: [SEND, SEND] });

    expect(res.summary).toEqual({ total: 2, queued: 1, failed: 1 });
    expect(res.data[1]!.status).toBe("failed");
  });
});
