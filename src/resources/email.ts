import { bytesToBase64 } from "../base64.js";
import type { HttpClient } from "../http.js";
import { renderMarkdown } from "../markdown.js";
import type { Attachment, RequestOptions } from "../types/common.js";
import type {
  BatchResponse,
  EmailBatchInput,
  EmailSendInput,
  MarkdownOptions,
  SendResponse,
} from "../types/email.js";

/** Operations on the `/email` endpoints. */
export class Email {
  constructor(private readonly http: HttpClient) {}

  /**
   * Send a single message. All addresses in `to`/`cc`/`bcc` share one
   * envelope. Pass `markdown` instead of `html`/`text` to render with the
   * optional `emailmd` package. Resolves with the queued message id; throws an
   * {@link AnypostError} subclass on failure.
   */
  async send(email: EmailSendInput, options?: RequestOptions): Promise<SendResponse> {
    const body = encodeAttachments(await resolveContent(email));
    return this.http.request<SendResponse>({
      method: "POST",
      path: "/email",
      body,
      idempotent: true,
      ...(options ? { options } : {}),
    });
  }

  /**
   * Send 1-100 independent messages in one request. Each entry may use
   * `markdown`; a `markdownOptions` set on `defaults` applies to every entry's
   * render. A mixed-outcome batch (HTTP `207`) resolves normally — inspect each
   * entry's `status` in `data`; it does not throw.
   */
  async sendBatch(
    batch: EmailBatchInput,
    options?: RequestOptions,
  ): Promise<BatchResponse> {
    const sharedMarkdownOptions = batch.defaults?.markdownOptions;
    const resolvedDefaults = batch.defaults
      ? encodeAttachments(await resolveContent(batch.defaults))
      : undefined;
    // Drop defaults that held only the SDK-only `markdownOptions`: nothing
    // remains for the wire after stripping it.
    const defaults =
      resolvedDefaults && Object.keys(resolvedDefaults).length > 0
        ? resolvedDefaults
        : undefined;
    const emails = await Promise.all(
      batch.emails.map(async (email) =>
        encodeAttachments(await resolveContent(email, sharedMarkdownOptions)),
      ),
    );
    const body = {
      ...(defaults ? { defaults } : {}),
      emails,
    };
    return this.http.request<BatchResponse>({
      method: "POST",
      path: "/email/batch",
      body,
      idempotent: true,
      ...(options ? { options } : {}),
    });
  }
}

interface ContentInput {
  markdown?: string;
  markdownOptions?: MarkdownOptions;
  html?: string;
  text?: string;
}

/**
 * Resolve a message's content for the wire: if it carries `markdown`, render it
 * to `html`+`text` via `emailmd` and drop the SDK-only `markdown`/
 * `markdownOptions` fields. `sharedOptions` (batch defaults) is merged under the
 * message's own `markdownOptions`. A message that sets neither `markdown` is
 * returned untouched apart from stripping a stray `markdownOptions`.
 */
async function resolveContent<T extends ContentInput>(
  message: T,
  sharedOptions?: MarkdownOptions,
): Promise<Omit<T, "markdown" | "markdownOptions">> {
  const { markdown, markdownOptions, ...rest } = message;
  if (markdown === undefined) {
    return rest as Omit<T, "markdown" | "markdownOptions">;
  }
  if (rest.html !== undefined || rest.text !== undefined) {
    throw new Error(
      "An email cannot set both `markdown` and `html`/`text`. Choose one content source.",
    );
  }
  const merged: MarkdownOptions | undefined =
    sharedOptions || markdownOptions
      ? { ...sharedOptions, ...markdownOptions }
      : undefined;
  const { html, text } = await renderMarkdown(markdown, merged);
  return { ...rest, html, text } as unknown as Omit<T, "markdown" | "markdownOptions">;
}

/**
 * Return a copy of an email (or batch defaults) with any byte-valued
 * attachment `content` base64-encoded. A `string` content is already encoded
 * and passes through untouched, as does an entry with no attachments.
 */
function encodeAttachments<T extends { attachments?: Attachment[] }>(message: T): T {
  if (!message.attachments) {
    return message;
  }
  return {
    ...message,
    attachments: message.attachments.map((attachment) =>
      typeof attachment.content === "string"
        ? attachment
        : { ...attachment, content: bytesToBase64(attachment.content) },
    ),
  };
}
