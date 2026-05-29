export { Anypost, type AnypostOptions } from "./client.js";
export { ApiKeys } from "./resources/api-keys.js";
export { Domains } from "./resources/domains.js";
export { Email } from "./resources/email.js";
export { Identity } from "./resources/identity.js";
export { Suppressions } from "./resources/suppressions.js";
export { Templates } from "./resources/templates.js";
export { Page, type ListParams, type PageResponse } from "./pagination.js";
export { SDK_VERSION } from "./version.js";

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
  BatchItemFailed,
  BatchItemQueued,
  BatchItemResult,
  BatchResponse,
  BatchSummary,
  EmailBatchDefaults,
  EmailBatchRequest,
  EmailSendRequest,
  SendResponse,
} from "./types/email.js";

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
  SuppressionCreateParams,
  SuppressionListParams,
  SuppressionOrigin,
  SuppressionReason,
} from "./types/suppression.js";

export type { WhoamiResponse } from "./types/identity.js";
