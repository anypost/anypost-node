import type { ListParams } from "../pagination.js";

/** Why an address is suppressed. */
export type SuppressionReason =
  | "permanent_bounce"
  | "complaint"
  | "unsubscribed"
  | "manual";

/** Provenance of a suppression row. */
export type SuppressionOrigin = "auto" | "manual";

/** A suppressed recipient address, scoped to a topic. */
export interface Suppression {
  /** `sup_`-prefixed id, for log correlation. Lookups/deletes key on `(email, topic)`. */
  id: string;
  /** The suppressed address, normalized to lowercase. */
  email: string;
  /** The topic this suppression applies to. `*` means every topic. */
  topic: string;
  reason: SuppressionReason;
  origin: SuppressionOrigin;
  /** Bounce classification or ARF feedback-type. `null` for manual entries. */
  classification: string | null;
  /** SMTP reply code from the bounce. `null` for complaints and manual entries. */
  smtp_code: number | null;
  /** Free-form note attached at creation. */
  note: string | null;
  /** When the suppression was first observed. */
  suppressed_at: string;
  /** Always `null`: suppressions do not expire. Kept for compatibility; removed in a future major version. */
  expires_at: string | null;
  created_at: string;
}

/** Query parameters for `suppressions.list`. */
export interface SuppressionListParams extends ListParams {
  /** Case-insensitive substring match against the address. */
  email_contains?: string;
  /** Restrict to a topic. `*` for global entries, or a specific topic name. */
  topic?: string;
  reason?: SuppressionReason;
  origin?: SuppressionOrigin;
}

/** Body for `suppressions.create`. */
export interface SuppressionCreateParams {
  email: string;
  /** Topic to scope the suppression. Omit or `*` to block every topic. */
  topic?: string;
  /** Optional internal annotation, preserved across automatic re-suppressions. */
  note?: string | null;
}

/** One entry for `suppressions.createBatch`. */
export interface SuppressionBatchItem {
  email: string;
  /** Topic to scope the suppression. Omit or `*` to block every topic. */
  topic?: string;
  /**
   * `permanent_bounce`, `complaint`, `unsubscribed` or `manual`. Common
   * equivalents (`hard bounce`, `spam report`, `opt-out`) are accepted;
   * anything else, or no value, records `manual`.
   */
  reason?: string | null;
  /** Optional internal annotation, preserved across automatic re-suppressions. */
  note?: string | null;
}

/** An entry `suppressions.createBatch` rejected because its `email` is not a valid address. */
export interface SuppressionBatchInvalid {
  /** Position of the entry in the array sent. */
  index: number;
  email: string | null;
}

/** Response from `suppressions.createBatch`. The three outcomes add up to the entries sent. */
export interface SuppressionBatchResult {
  /** Suppressions this call created. */
  imported: number;
  /** Entries already suppressed for that topic, including repeats within the batch. */
  already_suppressed: number;
  invalid: SuppressionBatchInvalid[];
}
