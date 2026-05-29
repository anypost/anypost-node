/** An event type a webhook can subscribe to. */
export type WebhookEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delayed"
  | "email.bounced"
  | "email.complained"
  | "email.suppressed"
  | "email.unsubscribed"
  | "email.opened"
  | "email.clicked";

/**
 * A webhook's delivery state. `active` receives deliveries; `disabled` is
 * paused without losing config; `circuit_disabled` is server-managed after
 * repeated failures and clears on recovery. Only `active` and `disabled` can
 * be set through the API.
 */
export type WebhookStatus = "active" | "circuit_disabled" | "disabled";

/** A webhook subscription. The signing secret is never returned here. */
export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEventType[];
  status: WebhookStatus;
  /** First 12 characters of the signing secret, for identification. */
  signing_secret_prefix: string;
  /** Prefix of the previous secret while a rotation grace window is open, else `null`. */
  signing_secret_previous_prefix: string | null;
  /** When the rotation grace window ends, or `null` if no rotation is in progress. */
  signing_secret_grace_expires_at: string | null;
  last_delivery_at: string | null;
  created_at: string;
}

/** A webhook with its full signing secret. Returned only on create and rotate-secret. */
export interface WebhookWithSecret extends Webhook {
  /** The full signing secret (`whsec_...`). Returned once; store it securely. */
  signing_secret: string;
}

/** The outcome of a synchronous test delivery. Never throws on a bad endpoint. */
export interface WebhookTestResult {
  /** True only when the endpoint returned a 2xx status. */
  delivered: boolean;
  /** HTTP status the endpoint returned, or `null` on a network failure. */
  status_code: number | null;
  /** Wall-clock time from request start to response or error, in milliseconds. */
  latency_ms: number;
  /** A human-readable failure reason, or `null` on success. */
  error: string | null;
  /** A truncated preview of the endpoint's response body, when available. */
  response_body_preview: string | null;
}

export interface WebhookCreateParams {
  name: string;
  /** An `https://` endpoint to receive signed deliveries. */
  url: string;
  /** At least one event type to subscribe to. */
  events: WebhookEventType[];
}

export interface WebhookUpdateParams {
  name: string;
  url: string;
  events: WebhookEventType[];
  /** Set `disabled` to pause delivery, `active` to resume. `circuit_disabled` is server-only. */
  status: "active" | "disabled";
}
