/** Permission level of an API key. */
export type Permissions = "full" | "send_only";

/**
 * Custom message headers as a name -> value map. Platform-controlled and
 * trust-signal headers are dropped server-side; at most 25 entries survive.
 */
export type HeaderMap = Record<string, string>;

/** An inline attachment. */
export interface Attachment {
  /** File name shown to the recipient. */
  filename: string;
  /**
   * File contents. Pass raw bytes (`Uint8Array`, or a Node `Buffer`) and the
   * client base64-encodes them; pass an already base64-encoded `string` and it
   * is sent as-is.
   */
  content: Uint8Array | string;
  /** MIME type. Defaults to `application/octet-stream` server-side. */
  content_type?: string;
  /** Content-ID for an inline attachment referenced from the HTML via `cid:`. */
  content_id?: string;
}

/** Per-message override of the sending domain's open/click tracking defaults. */
export interface Tracking {
  /** Inject the open-tracking pixel into the HTML body. */
  opens?: boolean;
  /** Rewrite links for click tracking. */
  clicks?: boolean;
}

/** One-click unsubscribe behavior. */
export interface Unsubscribe {
  /**
   * `generate` mints a per-recipient signed token and injects RFC 8058
   * unsubscribe headers (requires `topic`). `none` injects nothing.
   */
  mode: "generate" | "none";
  /** Human-readable label rendered on the hosted confirmation page. */
  display_name?: string;
}

/** Per-call overrides accepted by every request method. */
export interface RequestOptions {
  /**
   * Idempotency key for a send. 1-255 printable-ASCII characters. When
   * omitted on a retryable send, the client generates one so built-in
   * retries cannot send twice.
   */
  idempotencyKey?: string;
  /** Extra headers merged onto this request. */
  headers?: Record<string, string>;
  /** Override the client's `maxRetries` for this call. */
  maxRetries?: number;
  /** Override the client's `timeoutMs` for this call. */
  timeoutMs?: number;
  /** An external abort signal. Composed with the per-request timeout. */
  signal?: AbortSignal;
}
