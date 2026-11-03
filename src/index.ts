export { Anypost, type AnypostOptions } from "./client.js";
export { ApiKeys } from "./resources/api-keys.js";
export { Domains } from "./resources/domains.js";
export { Email } from "./resources/email.js";
export { Events } from "./resources/events.js";
export { Identity } from "./resources/identity.js";
export { Suppressions } from "./resources/suppressions.js";
export { Templates } from "./resources/templates.js";
export { Webhooks } from "./resources/webhooks.js";
export { Page, type ListParams, type PageResponse } from "./pagination.js";
export { renderMarkdown, type MarkdownRenderResult } from "./markdown.js";
export { SDK_VERSION } from "./version.js";

export {
  verifyWebhookSignature,
  unwrapWebhookEvent,
  WebhookVerificationError,
  type VerifyWebhookOptions,
  type WebhookDelivery,
  type WebhookDeliveryEvent,
  type WebhookVerificationFailure,
} from "./webhook-signature.js";

export {
  AnypostError,
  APIConnectionError,
  APIError,
  AuthenticationError,
  ConflictError,
  IdempotencyMismatchError,
  NotFoundError,
  PayloadTooLargeError,
  PermissionError,
  RateLimitError,
  ValidationError,
  type ErrorType,
} from "./errors.js";

export type {
  Attachment,
  HeaderMap,
  Permissions,
  RequestOptions,
  Tracking,
  Unsubscribe,
} from "./types/common.js";

export type {
  BatchItemError,
  BatchItemFailed,
  BatchItemQueued,
  BatchItemResult,
  BatchQuotaScope,
  BatchResponse,
  BatchSummary,
  EmailBatchDefaults,
  EmailBatchDefaultsInput,
  EmailBatchInput,
  EmailBatchRequest,
  EmailSendInput,
  EmailSendRequest,
  MarkdownContent,
  MarkdownOptions,
  SendResponse,
} from "./types/email.js";

export type {
  Event,
  EventBot,
  EventListParams,
  EventTracking,
  EventType,
} from "./types/event.js";

export type {
  DnsRecord,
  Domain,
  DomainCreateParams,
  DomainTracking,
  DomainUpdateParams,
  VerificationFailure,
} from "./types/domain.js";

export type {
  ApiKey,
  ApiKeyCreateParams,
  ApiKeyUpdateParams,
  ApiKeyWithSecret,
} from "./types/api-key.js";

export type {
  Template,
  TemplateCreateParams,
  TemplateDraft,
  TemplateDraftParams,
  TemplateDuplicateParams,
  TemplateKind,
  TemplateUpdateParams,
} from "./types/template.js";

export type {
  Suppression,
  SuppressionBatchInvalid,
  SuppressionBatchItem,
  SuppressionBatchResult,
  SuppressionCreateParams,
  SuppressionListParams,
  SuppressionOrigin,
  SuppressionReason,
} from "./types/suppression.js";

export type {
  Webhook,
  WebhookCreateParams,
  WebhookEventType,
  WebhookStatus,
  WebhookTestResult,
  WebhookUpdateParams,
  WebhookWithSecret,
} from "./types/webhook.js";

export type { WhoamiLimits, WhoamiResponse } from "./types/identity.js";
