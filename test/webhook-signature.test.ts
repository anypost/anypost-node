import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import {
  unwrapWebhookEvent,
  verifyWebhookSignature,
  WebhookVerificationError,
  type WebhookDelivery,
} from "../src/index.js";

const SECRET = "whsec_test_secret";

function hmac(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

/** Build an `Anypost-Signature` header the way the server signs deliveries. */
function sign(
  body: string,
  timestamp: number,
  secrets: string[] = [SECRET],
): string {
  const components = secrets.map((s) => `v1=${hmac(s, `${timestamp}.${body}`)}`);
  return `t=${timestamp},${components.join(",")}`;
}

const BODY = JSON.stringify({
  batch_id: "9c1f2a7b",
  timestamp: 1730000000,
  events: [{ id: "evt_1", type: "email.delivered", occurred_at: "x", data: { email_id: "email_1" } }],
});

describe("verifyWebhookSignature", () => {
  test("accepts a valid signature within tolerance", async () => {
    const now = 1730000000;
    const header = sign(BODY, now);
    await expect(
      verifyWebhookSignature(BODY, header, SECRET, { now }),
    ).resolves.toBeUndefined();
  });

  test("accepts a Uint8Array payload", async () => {
    const now = 1730000000;
    const header = sign(BODY, now);
    const bytes = new TextEncoder().encode(BODY);
    await expect(
      verifyWebhookSignature(bytes, header, SECRET, { now }),
    ).resolves.toBeUndefined();
  });

  test("matches when any v1 component matches (rotation grace window)", async () => {
    const now = 1730000000;
    // New secret signs first; the old secret we hold is the second component.
    const header = sign(BODY, now, ["whsec_new_secret", SECRET]);
    await expect(
      verifyWebhookSignature(BODY, header, SECRET, { now }),
    ).resolves.toBeUndefined();
  });

  test("rejects a tampered body", async () => {
    const now = 1730000000;
    const header = sign(BODY, now);
    const err = await verifyWebhookSignature(BODY + " ", header, SECRET, { now }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(WebhookVerificationError);
    expect(err.reason).toBe("no_match");
  });

  test("rejects a wrong secret", async () => {
    const now = 1730000000;
    const header = sign(BODY, now);
    const err = await verifyWebhookSignature(BODY, header, "whsec_wrong", {
      now,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(WebhookVerificationError);
    expect(err.reason).toBe("no_match");
  });

  test("rejects a stale timestamp outside tolerance", async () => {
    const signedAt = 1730000000;
    const header = sign(BODY, signedAt);
    const err = await verifyWebhookSignature(BODY, header, SECRET, {
      now: signedAt + 600,
      toleranceSeconds: 300,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(WebhookVerificationError);
    expect(err.reason).toBe("timestamp_out_of_tolerance");
  });

  test("toleranceSeconds 0 disables the age check", async () => {
    const signedAt = 1730000000;
    const header = sign(BODY, signedAt);
    await expect(
      verifyWebhookSignature(BODY, header, SECRET, {
        now: signedAt + 100_000,
        toleranceSeconds: 0,
      }),
    ).resolves.toBeUndefined();
  });

  test("rejects a header with no timestamp", async () => {
    const header = `v1=${hmac(SECRET, `1730000000.${BODY}`)}`;
    const err = await verifyWebhookSignature(BODY, header, SECRET).catch((e) => e);
    expect(err).toBeInstanceOf(WebhookVerificationError);
    expect(err.reason).toBe("no_timestamp");
  });

  test("rejects a header with no v1 signature", async () => {
    const err = await verifyWebhookSignature(BODY, "t=1730000000", SECRET, {
      toleranceSeconds: 0,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(WebhookVerificationError);
    expect(err.reason).toBe("no_signatures");
  });

  test("rejects an empty header", async () => {
    const err = await verifyWebhookSignature(BODY, "", SECRET).catch((e) => e);
    expect(err).toBeInstanceOf(WebhookVerificationError);
    expect(err.reason).toBe("malformed_header");
  });
});

describe("unwrapWebhookEvent", () => {
  test("returns the parsed delivery after verifying", async () => {
    const now = 1730000000;
    const header = sign(BODY, now);
    const delivery = await unwrapWebhookEvent<WebhookDelivery>(BODY, header, SECRET, {
      now,
    });
    expect(delivery.batch_id).toBe("9c1f2a7b");
    expect(delivery.events[0]!.type).toBe("email.delivered");
  });

  test("throws before parsing when the signature is bad", async () => {
    const now = 1730000000;
    const header = sign(BODY, now);
    await expect(
      unwrapWebhookEvent("not json", header, SECRET, { now }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });
});
