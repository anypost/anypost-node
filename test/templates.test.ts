import { describe, expect, test } from "bun:test";
import { Anypost } from "../src/index.js";
import { mockFetch } from "./helpers.js";

function template(overrides: Record<string, unknown> = {}) {
  return {
    id: "template_1",
    name: "Welcome email",
    subject: null,
    kind: "html",
    html: null,
    text: null,
    markdown: null,
    has_draft: true,
    published_at: null,
    created_at: "2026-04-30T12:00:00.0Z",
    updated_at: "2026-04-30T12:00:00.0Z",
    ...overrides,
  };
}

function draft(overrides: Record<string, unknown> = {}) {
  return {
    subject: "Welcome!",
    html: "<p>Hi</p>",
    text: "Hi",
    markdown: null,
    updated_at: "2026-04-30T12:00:00.0Z",
    ...overrides,
  };
}

describe("templates", () => {
  test("create posts the body and starts unpublished", async () => {
    const m = mockFetch([{ status: 201, body: template() }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const t = await anypost.templates.create({
      name: "Welcome email",
      kind: "html",
      html: "<p>Hi</p>",
    });

    expect(t.published_at).toBeNull();
    const req = m.calls[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.anypost.com/v1/templates");
    expect(req.body).toEqual({ name: "Welcome email", kind: "html", html: "<p>Hi</p>" });
  });

  test("update PATCHes only the name", async () => {
    const m = mockFetch([{ status: 200, body: template({ name: "Renamed" }) }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.templates.update("template_1", { name: "Renamed" });

    const req = m.calls[0]!;
    expect(req.method).toBe("PATCH");
    expect(req.url).toBe("https://api.anypost.com/v1/templates/template_1");
    expect(req.body).toEqual({ name: "Renamed" });
  });

  test("duplicate posts to the sub-path; body optional", async () => {
    const m = mockFetch([{ status: 201, body: template({ id: "template_2" }) }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.templates.duplicate("template_1");

    const req = m.calls[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.anypost.com/v1/templates/template_1/duplicate");
    expect(req.body).toBeUndefined();
  });

  test("getDraft reads the draft sub-resource", async () => {
    const m = mockFetch([{ status: 200, body: draft() }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const d = await anypost.templates.getDraft("template_1");

    expect(d.subject).toBe("Welcome!");
    expect(m.calls[0]!.url).toBe("https://api.anypost.com/v1/templates/template_1/draft");
  });

  test("updateDraft PATCHes the draft body", async () => {
    const m = mockFetch([{ status: 200, body: draft({ subject: "Updated" }) }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.templates.updateDraft("template_1", { subject: "Updated" });

    const req = m.calls[0]!;
    expect(req.method).toBe("PATCH");
    expect(req.url).toBe("https://api.anypost.com/v1/templates/template_1/draft");
    expect(req.body).toEqual({ subject: "Updated" });
  });

  test("deleteDraft resolves void on 204", async () => {
    const m = mockFetch([{ status: 204 }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    expect(await anypost.templates.deleteDraft("template_1")).toBeUndefined();
    expect(m.calls[0]!.method).toBe("DELETE");
    expect(m.calls[0]!.url).toBe("https://api.anypost.com/v1/templates/template_1/draft");
  });

  test("publish promotes the draft and returns the published template", async () => {
    const m = mockFetch([
      { status: 200, body: template({ has_draft: false, published_at: "2026-04-30T12:05:00.0Z", subject: "Welcome!" }) },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const t = await anypost.templates.publish("template_1");

    expect(t.has_draft).toBe(false);
    expect(t.published_at).not.toBeNull();
    const req = m.calls[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.anypost.com/v1/templates/template_1/publish");
  });
});
