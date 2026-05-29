import { bytesToBase64 } from "../base64.js";
import type { HttpClient } from "../http.js";
import type { Attachment, RequestOptions } from "../types/common.js";
import type {
  BatchResponse,
  EmailBatchRequest,
  EmailSendRequest,
  SendResponse,
} from "../types/email.js";

/** Operations on the `/email` endpoints. */
export class Email {
  constructor(private readonly http: HttpClient) {}

  /**
   * Send a single message. All addresses in `to`/`cc`/`bcc` share one
   * envelope. Resolves with the queued message id; throws an
   * {@link AnypostError} subclass on failure.
   */
  send(email: EmailSendRequest, options?: RequestOptions): Promise<SendResponse> {
    return this.http.request<SendResponse>({
      method: "POST",
      path: "/email",
      body: encodeAttachments(email),
      idempotent: true,
      ...(options ? { options } : {}),
    });
  }

  /**
   * Send 1-100 independent messages in one request. A mixed-outcome batch
   * (HTTP `207`) resolves normally — inspect each entry's `status` in
   * `data`; it does not throw.
   */
  sendBatch(
    batch: EmailBatchRequest,
    options?: RequestOptions,
  ): Promise<BatchResponse> {
    const body: EmailBatchRequest = {
      ...batch,
      ...(batch.defaults ? { defaults: encodeAttachments(batch.defaults) } : {}),
      emails: batch.emails.map(encodeAttachments),
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
