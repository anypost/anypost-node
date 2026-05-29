import type { WebhookEventType } from "./types/webhook.js";

/**
 * Why a signature failed to verify. Branch on this rather than the message.
 *
 * - `malformed_header` — the `Anypost-Signature` header could not be parsed.
 * - `no_timestamp` — the header carried no `t=` component.
 * - `no_signatures` — the header carried no `v1=` component.
 * - `timestamp_out_of_tolerance` — the delivery is older than the tolerance.
 * - `no_match` — no `v1=` component matched the computed signature.
 */
export type WebhookVerificationFailure =
  | "malformed_header"
  | "no_timestamp"
  | "no_signatures"
  | "timestamp_out_of_tolerance"
  | "no_match";

/** Thrown when a webhook delivery's signature cannot be verified. */
export class WebhookVerificationError extends Error {
  /** The machine-readable reason. Branch on this. */
  readonly reason: WebhookVerificationFailure;
  constructor(message: string, reason: WebhookVerificationFailure) {
    super(message);
    this.name = "WebhookVerificationError";
    this.reason = reason;
  }
}

export interface VerifyWebhookOptions {
  /**
   * Maximum age of a delivery, in seconds, measured from its signed timestamp.
   * Rejecting old deliveries bounds replay of a captured request. Default 300
   * (5 minutes). Set `0` to disable the check.
   */
  toleranceSeconds?: number;
  /** Override the current time (seconds since the Unix epoch). For testing. */
  now?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();

/**
 * Verify an Anypost webhook signature. Pass the **raw** request body (the exact
 * bytes received, before JSON parsing), the `Anypost-Signature` header value,
 * and the webhook's signing secret. Resolves on success; throws
 * {@link WebhookVerificationError} otherwise.
 *
 * The header may carry more than one `v1=` component during a secret rotation;
 * a match on any one passes, so deliveries keep verifying across a rotation.
 *
 * ```ts
 * await verifyWebhookSignature(rawBody, req.headers["anypost-signature"], secret);
 * ```
 */
export async function verifyWebhookSignature(
  payload: string | Uint8Array,
  signatureHeader: string,
  secret: string,
  options?: VerifyWebhookOptions,
): Promise<void> {
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);

  const tolerance = options?.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (tolerance > 0) {
    const now = options?.now ?? Math.floor(Date.now() / 1000);
    if (now - timestamp > tolerance) {
      throw new WebhookVerificationError(
        `Timestamp ${timestamp} is older than the ${tolerance}s tolerance.`,
        "timestamp_out_of_tolerance",
      );
    }
  }

  const body = typeof payload === "string" ? payload : decodeBody(payload);
  const expected = await hmacHex(secret, `${timestamp}.${body}`);

  // Constant-time over every candidate: accumulate matches without early exit.
  let matched = false;
  for (const candidate of signatures) {
    if (timingSafeEqual(candidate, expected)) matched = true;
  }
  if (!matched) {
    throw new WebhookVerificationError(
      "No signature in the header matched the computed signature.",
      "no_match",
    );
  }
}

/**
 * Verify a delivery and return its parsed JSON body. A thin wrapper over
 * {@link verifyWebhookSignature} that runs `JSON.parse` only after the
 * signature checks out. Supply the payload type, or use the default
 * {@link WebhookDelivery} envelope.
 */
export async function unwrapWebhookEvent<T = WebhookDelivery>(
  payload: string | Uint8Array,
  signatureHeader: string,
  secret: string,
  options?: VerifyWebhookOptions,
): Promise<T> {
  await verifyWebhookSignature(payload, signatureHeader, secret, options);
  const body = typeof payload === "string" ? payload : decodeBody(payload);
  return JSON.parse(body) as T;
}

/** The outer envelope of a webhook delivery: one batch of one or more events. */
export interface WebhookDelivery {
  /** Identifier for this batch. Stable across retries — de-duplicate on it. */
  batch_id: string;
  /** Unix timestamp the batch was signed with. */
  timestamp: number;
  events: WebhookDeliveryEvent[];
}

/** One event inside a {@link WebhookDelivery}. */
export interface WebhookDeliveryEvent {
  /** Unique event id. Stable across retries — de-duplicate on it. */
  id: string;
  type: WebhookEventType | "webhook.test";
  occurred_at: string;
  /** Always carries `email_id`; the rest depends on the event type. */
  data: Record<string, unknown>;
}

interface ParsedSignature {
  timestamp: number;
  signatures: string[];
}

function parseSignatureHeader(header: string): ParsedSignature {
  if (!header) {
    throw new WebhookVerificationError(
      "The Anypost-Signature header is empty.",
      "malformed_header",
    );
  }

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (timestamp === null) {
    throw new WebhookVerificationError(
      "The Anypost-Signature header has no timestamp (t=).",
      "no_timestamp",
    );
  }
  if (signatures.length === 0) {
    throw new WebhookVerificationError(
      "The Anypost-Signature header has no v1= signature.",
      "no_signatures",
    );
  }
  return { timestamp, signatures };
}

function decodeBody(payload: Uint8Array): string {
  return new TextDecoder().decode(payload);
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return toHex(new Uint8Array(signature));
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/** Constant-time string compare. Compares every character to avoid early exit. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
