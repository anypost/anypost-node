export { Anypost, type AnypostOptions } from "./client.js";
export { Domains } from "./resources/domains.js";
export { Email } from "./resources/email.js";
export { Identity } from "./resources/identity.js";
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

export type { WhoamiResponse } from "./types/identity.js";
