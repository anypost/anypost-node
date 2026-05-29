import { describe, expect, test } from "bun:test";
import { Anypost, ValidationError } from "../src/index.js";
import { mockFetch } from "./helpers.js";

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_8f2c1b3e6a5d4f7c9a3e1d2b4c5e6f7a",
    type: "email.delivered",
    occurred_at: "2026-05-10T12:00:01.5Z",
    email_id: "email_019e1972-e87e-7000-bf74-ba09e0ed0d62",
    message_id: null,
    from: "you@example.com",
    from_domain: "example.com",
    recipient: "alex@customer.com",
    subject: "Welcome",
    campaign: null,
    template_id: null,
    topic: "newsletter",
    tags: ["onboarding"],
    smtp_code: 250,
    bounce_type: null,
    bounce_classification: null,
    attempt: 1,
    ...overrides,
  };
}

describe("events", () => {
  test("list returns a page and exposes the wire envelope", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [event()], has_more: false, next_cursor: null } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const page = await anypost.events.list();

    expect(page.data[0]!.type).toBe("email.delivered");
    expect(page.data[0]!.tags).toEqual(["onboarding"]);
    expect(page.data[0]!.smtp_code).toBe(250);
    expect(page.has_more).toBe(false);
    expect(page.next_cursor).toBeNull();
    const req = m.calls[0]!;
    expect(req.method).toBe("GET");
    expect(new URL(req.url).pathname).toBe("/v1/events");
  });

  test("list threads every filter into the query string", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [], has_more: false, next_cursor: null } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.events.list({
      limit: 50,
      start: "2026-05-10T00:00:00Z",
      end: "2026-05-11T00:00:00Z",
      event_type: "email.bounced",
      recipient: "alex@customer.com",
      email_id: "email_019e1972-e87e-7000-bf74-ba09e0ed0d62",
      message_id: "<abc@mail>",
      domain: "example.com",
      topic: "marketing",
      campaign: "spring_promo_2026",
      template_id: "template_019e2d74",
      tags: ["onboarding", "welcome"],
    });

    const params = new URL(m.calls[0]!.url).searchParams;
    expect(params.get("limit")).toBe("50");
    expect(params.get("tags")).toBe("onboarding,welcome");
    expect(params.get("start")).toBe("2026-05-10T00:00:00Z");
    expect(params.get("end")).toBe("2026-05-11T00:00:00Z");
    expect(params.get("event_type")).toBe("email.bounced");
    expect(params.get("recipient")).toBe("alex@customer.com");
    expect(params.get("email_id")).toBe("email_019e1972-e87e-7000-bf74-ba09e0ed0d62");
    expect(params.get("message_id")).toBe("<abc@mail>");
    expect(params.get("domain")).toBe("example.com");
    expect(params.get("topic")).toBe("marketing");
    expect(params.get("campaign")).toBe("spring_promo_2026");
    expect(params.get("template_id")).toBe("template_019e2d74");
  });

  test("omits the tags query param when the array is empty", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [], has_more: false, next_cursor: null } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.events.list({ tags: [] });

    expect(new URL(m.calls[0]!.url).searchParams.has("tags")).toBe(false);
  });

  test("iterating the page walks every page, carrying the cursor as after", async () => {
    const m = mockFetch([
      { status: 200, body: { data: [event({ id: "evt_1" })], has_more: true, next_cursor: "CUR2" } },
      { status: 200, body: { data: [event({ id: "evt_2" })], has_more: false, next_cursor: null } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const seen: string[] = [];
    for await (const e of await anypost.events.list({ event_type: "email.opened" })) {
      seen.push(e.id);
    }

    expect(seen).toEqual(["evt_1", "evt_2"]);
    // The filter persists onto the next page alongside the cursor.
    const page2 = new URL(m.calls[1]!.url).searchParams;
    expect(page2.get("after")).toBe("CUR2");
    expect(page2.get("event_type")).toBe("email.opened");
  });

  test("an unknown domain surfaces a 400 as ValidationError", async () => {
    const m = mockFetch([
      { status: 400, body: { error: { type: "validation_error", message: "Unknown domain." } } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await expect(
      anypost.events.list({ domain: "nope.example" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
