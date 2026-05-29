import { describe, expect, test } from "bun:test";
import { Anypost, NotFoundError } from "../src/index.js";
import { mockFetch } from "./helpers.js";

function domain(overrides: Record<string, unknown> = {}) {
  return {
    id: "domain_1",
    name: "example.com",
    status: "pending",
    dns_records: [
      { type: "CNAME", name: "anypost", value: "x.c.anypost.co", purpose: "verification" },
    ],
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
    verified_at: null,
    ...overrides,
  };
}

describe("domains", () => {
  test("create posts the name and returns the domain", async () => {
    const m = mockFetch([{ status: 201, body: domain() }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const d = await anypost.domains.create({ name: "example.com" });

    expect(d.id).toBe("domain_1");
    const req = m.calls[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.anypost.com/v1/domains");
    expect(req.body).toEqual({ name: "example.com" });
    // domain management is not an idempotent endpoint — no auto key.
    expect(req.headers["idempotency-key"]).toBeUndefined();
  });

  test("get retrieves by id", async () => {
    const m = mockFetch([{ status: 200, body: domain() }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.domains.get("domain_1");

    expect(m.calls[0]!.method).toBe("GET");
    expect(m.calls[0]!.url).toBe("https://api.anypost.com/v1/domains/domain_1");
  });

  test("get on a missing domain throws NotFoundError", async () => {
    const m = mockFetch([
      { status: 404, body: { error: { type: "not_found", message: "No such domain." } } },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await expect(anypost.domains.get("domain_missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  test("update PATCHes the tracking patch", async () => {
    const m = mockFetch([
      { status: 200, body: domain({ tracking: { ...domain().tracking, opens_enabled: true, subdomain: "track" } }) },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    await anypost.domains.update("domain_1", {
      tracking: { opens_enabled: true, subdomain: "track" },
    });

    const req = m.calls[0]!;
    expect(req.method).toBe("PATCH");
    expect(req.body).toEqual({ tracking: { opens_enabled: true, subdomain: "track" } });
  });

  test("delete resolves void on 204", async () => {
    const m = mockFetch([{ status: 204 }]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const res = await anypost.domains.delete("domain_1");

    expect(res).toBeUndefined();
    expect(m.calls[0]!.method).toBe("DELETE");
  });

  test("verify returns a still-pending domain without throwing", async () => {
    const m = mockFetch([
      {
        status: 200,
        body: domain({
          status: "pending",
          verification_failure: { code: "apex_cname_missing", message: "Publish the CNAME." },
        }),
      },
    ]);
    const anypost = new Anypost("ap_test", { fetch: m.fetch });

    const d = await anypost.domains.verify("domain_1");

    expect(m.calls[0]!.url).toBe("https://api.anypost.com/v1/domains/domain_1/verify");
    expect(d.status).toBe("pending");
    expect(d.verification_failure?.code).toBe("apex_cname_missing");
  });
});
