import type {
  Attachment,
  HeaderMap,
  Tracking,
  Unsubscribe,
} from "./common.js";

/**
 * A single message to send. At least one of `text`, `html`, or `template_id`
 * is required; `template_id` cannot be combined with inline `text`/`html`.
 * When `unsubscribe.mode` is `"generate"`, `topic` is also required.
 */
export interface EmailSendRequest {
  /** Sender address on a verified domain. Bare or `Display Name <addr@host>`. */
  from: string;
  /** 1-50 primary recipients. Combined `to`+`cc`+`bcc` must be <= 50. */
  to: string[];
  cc?: string[];
  bcc?: string[];
  /** One address or up to 10. */
  reply_to?: string | string[];
  /** Required unless a referenced template supplies it. */
  subject?: string;
  text?: string;
  html?: string;
  /** Reference to a published template (`template_<uuid>`). */
  template_id?: string;
  headers?: HeaderMap;
  /** Up to 20 inline attachments. */
  attachments?: Attachment[];
  /** Up to 10 free-form labels (`[A-Za-z0-9_-]{1,64}`). */
  tags?: string[];
  /** Stream-segmentation label (`[A-Za-z0-9_-]{1,64}`). */
  campaign?: string;
  /** Suppression scope / topic bucket (`[a-z0-9_.-]{1,64}`). */
  topic?: string;
  tracking?: Tracking;
  /** Handlebars substitution map. Encoded JSON must be <= 64 KB. */
  variables?: Record<string, unknown>;
  unsubscribe?: Unsubscribe;
}

/**
 * Batch-wide defaults. Applied to every entry that does not set its own value.
 * `to` is excluded — recipients are always per-entry. See the API docs for the
 * per-field merge semantics (scalars override, lists concatenate).
 */
export type EmailBatchDefaults = Omit<Partial<EmailSendRequest>, "to">;

/** Body for `POST /email/batch`. 1-100 messages. */
export interface EmailBatchRequest {
  defaults?: EmailBatchDefaults;
  emails: EmailSendRequest[];
}

/**
 * Options forwarded to the optional `emailmd` package's `render()`. This mirrors
 * emailmd's `RenderOptions` but is kept self-contained so the SDK's types never
 * require emailmd to be installed. See the emailmd docs for the full `theme`
 * shape and behavior.
 */
export interface MarkdownOptions {
  /** Theme overrides (brand color, fonts, spacing, …). Merged onto the default theme. */
  theme?: Record<string, unknown>;
  /** Inline and collapse the output HTML. Default `false`. */
  minify?: boolean;
  /** Custom web fonts as `{ [family]: url }`. */
  fonts?: Record<string, string>;
  /** How strictly to validate the markdown. Default `"soft"`. */
  validationLevel?: "skip" | "soft" | "strict";
  /** Template-variable delimiters left untouched for later substitution. */
  templateSyntax?: Array<{ prefix: string; suffix: string }>;
  /** Strip disallowed inline styles. Requires `minify: true`. */
  sanitizeStyles?: boolean;
  /** Pretty-print the output HTML. Default `false`. */
  beautify?: boolean;
}

/**
 * Input to {@link EmailSendInput}'s content fields when sending markdown.
 * `markdown` is rendered to `html` and `text` by the optional `emailmd` package
 * at send time, then removed before the request. It cannot be combined with an
 * explicit `html` or `text`.
 */
export interface MarkdownContent {
  /** Markdown source, rendered to `html` + `text` via `emailmd` before sending. */
  markdown?: string;
  /** Options forwarded to `emailmd`'s `render()` for this message. */
  markdownOptions?: MarkdownOptions;
}

/**
 * Input accepted by {@link Email.send}. A wire {@link EmailSendRequest}, plus the
 * SDK-only `markdown`/`markdownOptions` fields. Supply `markdown` instead of
 * `html`/`text` to render with `emailmd`; the two SDK-only fields are stripped
 * before the request.
 */
export interface EmailSendInput extends EmailSendRequest, MarkdownContent {}

/** Batch defaults accepting the SDK-only markdown fields. `markdownOptions` here applies to every entry's markdown. */
export type EmailBatchDefaultsInput = Omit<Partial<EmailSendInput>, "to">;

/** Input accepted by {@link Email.sendBatch}. 1-100 messages, each allowing `markdown`. */
export interface EmailBatchInput {
  defaults?: EmailBatchDefaultsInput;
  emails: EmailSendInput[];
}

/** Response from a successful single send (`202`). */
export interface SendResponse {
  /** Public message identifier (`email_<uuidv7>`). */
  id: string;
  created_at: string;
}

export interface BatchItemQueued {
  status: "queued";
  /** Zero-based position in the request `emails` array. */
  index: number;
  id: string;
  created_at: string;
}

export interface BatchItemFailed {
  status: "failed";
  index: number;
  /** Inner canonical error: `{ type, message }`, no wrapping `error` key. */
  error: {
    type: "validation_error" | "permission_error" | "internal_error";
    message: string;
  };
}

/** Per-entry outcome of a batch send. Discriminated by `status`. */
export type BatchItemResult = BatchItemQueued | BatchItemFailed;

export interface BatchSummary {
  total: number;
  queued: number;
  failed: number;
}

/**
 * Response from `POST /email/batch`. A `207` (mixed outcomes) is a success,
 * not an error: inspect each entry's `status`. `data[i].index === i`.
 */
export interface BatchResponse {
  summary: BatchSummary;
  data: BatchItemResult[];
}
