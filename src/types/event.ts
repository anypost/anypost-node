import type { ListParams } from "../pagination.js";

/**
 * A customer-facing event type. The same set is emitted via webhooks
 * (see `WebhookEventType`); operational events are never returned here.
 */
export type EventType =
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
 * Bot classification for a proxied open or click. Pure-noise machine traffic
 * (mailbox prefetchers, scanners) never becomes an event, so the only kind a
 * customer ever sees is `proxy` — a real open whose origin is anonymized by a
 * mailbox image proxy (Gmail, Yahoo, etc.).
 */
export interface EventBot {
  /** The detected mailbox image proxy, e.g. `google`, `yahoo`, `bing`. */
  source: string;
  /** Always `proxy` on customer-visible events. */
  kind: "proxy";
}

/**
 * Tracking metadata on `email.opened` / `email.clicked` events, mirroring the
 * webhook payload's `data.tracking`. Carries `bot` only when the interaction
 * came from a mailbox image proxy; a human open/click has no `bot`.
 */
export interface EventTracking {
  bot?: EventBot;
}

/**
 * A single email-pipeline event for the team. Every field is always present;
 * fields that don't apply to a given event type are `null` rather than absent.
 */
export interface Event {
  /** Stable id for log correlation. Not addressable — there is no `GET /events/{id}`. */
  id: string;
  type: EventType;
  /** ISO 8601 UTC timestamp of when the event was observed. */
  occurred_at: string;
  /** The `email_<uuidv7>` id minted when the message was accepted. */
  email_id: string | null;
  /** The RFC 5322 `Message-ID:` header, when a relaying server stamped one. */
  message_id: string | null;
  /** The envelope `From:` address. */
  from: string | null;
  /** The `From:` domain, lowercased. */
  from_domain: string | null;
  /** The single recipient this event refers to. */
  recipient: string | null;
  /** The captured `Subject:` header, truncated at the capture limit. */
  subject: string | null;
  /** The originating send's `campaign` value. */
  campaign: string | null;
  /** Public id of the template the originating send used. */
  template_id: string | null;
  /** Send-time topic the message was tagged with. */
  topic: string | null;
  /** Customer-supplied tags from the originating send. Empty array when none. */
  tags: string[];
  /** SMTP reply code observed (250 on delivery, 5xx on bounce). `null` without an SMTP exchange. */
  smtp_code: number | null;
  /** Bounce type (e.g. `Hard`, `Soft`). Only on `email.bounced`. */
  bounce_type: string | null;
  /** Bounce classification (e.g. `InvalidRecipient`). Only on `email.bounced`. */
  bounce_classification: string | null;
  /** Delivery attempt number for this recipient. `null` for non-delivery events. */
  attempt: number | null;
  /**
   * Tracking metadata, mirroring the webhook payload's `data.tracking`. `null`
   * on every event except opens and clicks, and on human opens/clicks. Carries
   * `bot` when the open/click came from a mailbox image proxy.
   */
  tracking: EventTracking | null;
}

/**
 * Query parameters for `events.list`. The window defaults to the last 24 hours
 * and is clamped to the plan's retention. All filters are exact-match.
 */
export interface EventListParams extends ListParams {
  /** ISO 8601 start of the window (inclusive). Defaults to 24h before `end`. */
  start?: string;
  /** ISO 8601 end of the window (exclusive). Defaults to now. */
  end?: string;
  /** Restrict to one event type. */
  event_type?: EventType;
  /** Exact recipient address (lowercased server-side). */
  recipient?: string;
  /** Restrict to one message's `email_<uuidv7>` id. */
  email_id?: string;
  /** Exact `Message-ID:` header match. */
  message_id?: string;
  /** Sending domain hostname (not the `domain_<uuid>` id). Unknown domains return `400`. */
  domain?: string;
  /** Send-time topic. */
  topic?: string;
  /** Send-time `campaign` value. Case-sensitive exact match. */
  campaign?: string;
  /** Template the originating send used. */
  template_id?: string;
  /**
   * Restrict to events carrying any of these tags (`hasAny` — an event
   * matches if it has at least one of the values, not all). Up to 10; values
   * outside `[A-Za-z0-9_-]{1,64}` are dropped server-side.
   */
  tags?: string[];
}
