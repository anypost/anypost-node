/** Machine-readable error type. Branch on this, not on the HTTP status. */
export type ErrorType =
  | "validation_error"
  | "authentication_error"
  | "permission_error"
  | "not_found"
  | "conflict"
  | "rate_limit_exceeded"
  | "idempotency_concurrent"
  | "idempotency_mismatch"
  | "webhook_rotation_in_progress"
  | "provisioning_error"
  | "internal_error"
  | "payload_too_large"
  | "connection_error"
  // Forward-compatible: the server may add types this SDK predates.
  | (string & {});

interface ErrorProps {
  type: string;
  status: number | null;
  requestId: string | null;
  raw: unknown;
}

/** Base class for every error thrown by the SDK. */
export class AnypostError extends Error {
  /** Stable, machine-readable error type. */
  readonly type: ErrorType;
  /** HTTP status, or `null` when no response was received. */
  readonly status: number | null;
  /** Request id from the response, when present. */
  readonly requestId: string | null;
  /** The parsed response body (or underlying cause for connection errors). */
  readonly raw: unknown;

  constructor(message: string, props: ErrorProps) {
    super(message);
    this.name = new.target.name;
    this.type = props.type;
    this.status = props.status;
    this.requestId = props.requestId;
    this.raw = props.raw;
  }
}

/** `400`/`422` — the request body or query failed validation. */
export class ValidationError extends AnypostError {
  /** Field path -> list of problems. Present for `validation_error`. */
  readonly errors: Record<string, string[]>;
  constructor(
    message: string,
    props: ErrorProps,
    errors: Record<string, string[]> = {},
  ) {
    super(message, props);
    this.errors = errors;
  }
}

/** `401` — the API key is missing or invalid. */
export class AuthenticationError extends AnypostError {}

/** `403` — the key may not perform this action. */
export class PermissionError extends AnypostError {}

/** `404` — no such resource for this team. */
export class NotFoundError extends AnypostError {}

/** `409` — conflict (`conflict`, `idempotency_concurrent`, `webhook_rotation_in_progress`). */
export class ConflictError extends AnypostError {}

/** `422` `idempotency_mismatch` — a key was reused with a different body. */
export class IdempotencyMismatchError extends AnypostError {}

/** `429` — a rate limit was exceeded. */
export class RateLimitError extends AnypostError {
  /** Parsed `Retry-After`, in milliseconds, when the server sent one. */
  readonly retryAfterMs: number | null;
  constructor(message: string, props: ErrorProps, retryAfterMs: number | null) {
    super(message, props);
    this.retryAfterMs = retryAfterMs;
  }
}

/** `413` — the request body exceeded the 5 MB gateway limit. */
export class PayloadTooLargeError extends AnypostError {}

/** A server error (`5xx`), including `internal_error` and `provisioning_error`. */
export class APIError extends AnypostError {}

/** No HTTP response was received (network failure, timeout, or abort). */
export class APIConnectionError extends AnypostError {
  constructor(message: string, cause: unknown) {
    super(message, {
      type: "connection_error",
      status: null,
      requestId: null,
      raw: cause,
    });
  }
}

const REQUEST_ID_HEADERS = [
  "anypost-request-id",
  "x-anypost-request-id",
  "x-request-id",
];

function readRequestId(headers: Headers): string | null {
  for (const name of REQUEST_ID_HEADERS) {
    const value = headers.get(name);
    if (value) return value;
  }
  return null;
}

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) into milliseconds. */
export function retryAfterMs(headers: Headers): number | null {
  const value = headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}

type ErrorEnvelope = {
  error?: string | { type?: string; message?: string; errors?: unknown };
  message?: string;
};

/** Build the right error subclass from an HTTP response. */
export function parseError(
  status: number,
  body: unknown,
  headers: Headers,
): AnypostError {
  const envelope = (body ?? {}) as ErrorEnvelope;
  const requestId = readRequestId(headers);

  let type: string;
  let message: string;
  let errors: Record<string, string[]> = {};

  if (envelope.error && typeof envelope.error === "object") {
    // Canonical envelope: { error: { type, message, errors? } }.
    type = envelope.error.type ?? typeFromStatus(status);
    message = envelope.error.message ?? defaultMessage(status);
    if (envelope.error.errors && typeof envelope.error.errors === "object") {
      errors = envelope.error.errors as Record<string, string[]>;
    }
  } else if (typeof envelope.error === "string") {
    // Flat envelope: { error: "<code>", message? }.
    type = envelope.error;
    message = envelope.message ?? humanize(type);
  } else {
    type = typeFromStatus(status);
    message = defaultMessage(status);
  }

  const props: ErrorProps = { type, status, requestId, raw: body };

  switch (type) {
    case "validation_error":
      return new ValidationError(message, props, errors);
    case "authentication_error":
      return new AuthenticationError(message, props);
    case "permission_error":
      return new PermissionError(message, props);
    case "not_found":
      return new NotFoundError(message, props);
    case "conflict":
    case "idempotency_concurrent":
    case "webhook_rotation_in_progress":
      return new ConflictError(message, props);
    case "idempotency_mismatch":
      return new IdempotencyMismatchError(message, props);
    case "rate_limit_exceeded":
      return new RateLimitError(message, props, retryAfterMs(headers));
    case "payload_too_large":
      return new PayloadTooLargeError(message, props);
    case "provisioning_error":
    case "internal_error":
      return new APIError(message, props);
  }

  // Unknown type: fall back to the closest class for the status.
  return byStatus(status, message, props, errors, headers);
}

function byStatus(
  status: number,
  message: string,
  props: ErrorProps,
  errors: Record<string, string[]>,
  headers: Headers,
): AnypostError {
  if (status === 401) return new AuthenticationError(message, props);
  if (status === 403) return new PermissionError(message, props);
  if (status === 404) return new NotFoundError(message, props);
  if (status === 409) return new ConflictError(message, props);
  if (status === 413) return new PayloadTooLargeError(message, props);
  if (status === 429) {
    return new RateLimitError(message, props, retryAfterMs(headers));
  }
  if (status === 400 || status === 422) {
    return new ValidationError(message, props, errors);
  }
  if (status >= 500) return new APIError(message, props);
  return new AnypostError(message, props);
}

function typeFromStatus(status: number): string {
  switch (status) {
    case 401:
      return "authentication_error";
    case 403:
      return "permission_error";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 413:
      return "payload_too_large";
    case 429:
      return "rate_limit_exceeded";
    case 400:
    case 422:
      return "validation_error";
    default:
      return status >= 500 ? "internal_error" : "api_error";
  }
}

function defaultMessage(status: number): string {
  return `Anypost request failed with status ${status}.`;
}

function humanize(code: string): string {
  return code.replace(/_/g, " ");
}
