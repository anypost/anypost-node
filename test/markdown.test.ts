import { describe, expect, test } from "bun:test";
import { Anypost, renderMarkdown } from "../src/index.js";
import { mockFetch } from "./helpers.js";

const QUEUED = { status: 202, body: { id: "email_1", created_at: "x" } };
const BASE = { from: "Acme <you@acme.com>", to: ["a@example.com"], subject: "Hi" };

describe("renderMarkdown", () => {
  test("produces an HTML document and a plain-text alternative", async () => {
    const { html, text, meta } = await renderMarkdown(
      "---\npreheader: Peek\n---\n# Title\n\nHello **world**.",
    );
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Title");
    expect(text).toContain("Hello world");
    expect(meta.preheader).toBe("Peek");
  });
});

describe("email.send with markdown", () => {
  test("renders markdown to html+text and strips the SDK-only fields", async () => {
    const m = mockFetch([QUEUED]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.email.send({ ...BASE, markdown: "# Hi\n\nFrom markdown." });

    const body = m.calls[0]!.body as Record<string, unknown>;
    expect(body.markdown).toBeUndefined();
    expect(body.markdownOptions).toBeUndefined();
    expect(body.html as string).toContain("<!doctype html>");
    expect(body.text as string).toContain("From markdown");
    expect(body.subject).toBe("Hi");
  });

  test("rejects markdown combined with html or text", async () => {
    const m = mockFetch([QUEUED]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await expect(
      anypost.email.send({ ...BASE, markdown: "# Hi", html: "<p>Hi</p>" }),
    ).rejects.toThrow(/cannot set both/);
    expect(m.calls.length).toBe(0);
  });

  test("leaves a plain html/text message untouched", async () => {
    const m = mockFetch([QUEUED]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.email.send({ ...BASE, html: "<p>Hi</p>" });

    const body = m.calls[0]!.body as Record<string, unknown>;
    expect(body.html).toBe("<p>Hi</p>");
    expect(body.text).toBeUndefined();
  });
});

describe("email.sendBatch with markdown", () => {
  test("renders each entry and applies defaults.markdownOptions to every render", async () => {
    const m = mockFetch([
      {
        status: 202,
        body: {
          summary: { total: 2, queued: 2, failed: 0 },
          data: [
            { status: "queued", index: 0, id: "email_1", created_at: "x" },
            { status: "queued", index: 1, id: "email_2", created_at: "x" },
          ],
        },
      },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.email.sendBatch({
      defaults: { markdownOptions: { validationLevel: "skip" } },
      emails: [
        { ...BASE, markdown: "# One" },
        { ...BASE, to: ["b@example.com"], html: "<p>Two</p>" },
      ],
    });

    const body = m.calls[0]!.body as {
      defaults?: unknown;
      emails: Array<Record<string, unknown>>;
    };
    // markdownOptions on defaults is SDK-only: stripped, not sent on the wire.
    expect(body.defaults).toBeUndefined();
    expect(body.emails[0]!.markdown).toBeUndefined();
    expect(body.emails[0]!.html as string).toContain("One");
    expect(body.emails[0]!.text as string).toContain("ONE");
    expect(body.emails[1]!.html).toBe("<p>Two</p>");
  });
});
