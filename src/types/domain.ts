/** A DNS record the customer must publish to verify a domain or its tracking. */
export interface DnsRecord {
  /** Record type. `CNAME` is the only value today. */
  type: "CNAME";
  /**
   * Record name to publish, relative to the registered (ICANN) apex of the
   * sending domain — the form most provider UIs accept. Concatenate with the
   * registered apex for the absolute FQDN.
   */
  name: string;
  /** The CNAME target (absolute FQDN). */
  value: string;
  /** What the record is for. `verification` is always present; `dkim` once per selector; `tracking` only when branded tracking is on. */
  purpose: "verification" | "dkim" | "tracking";
}

/** A stable failure category plus a human-readable message. */
export interface VerificationFailure {
  /** Stable, switchable failure code. The set varies by field; see the API docs. */
  code: string;
  /** Human-readable message with the domain's record names interpolated. */
  message: string;
}

/** Branded open/click tracking configuration for a domain. Independent of mail-flow verification. */
export interface DomainTracking {
  /** Whether an open-tracking pixel is injected into outgoing HTML. */
  opens_enabled: boolean;
  /** Whether links are rewritten for click tracking. */
  clicks_enabled: boolean;
  /** Tracking subdomain prefix relative to the sending domain, or `null` when tracking is off. */
  subdomain: string | null;
  /** Branded-tracking DNS records to publish. Empty when tracking is off. */
  dns_records: DnsRecord[];
  /** `disabled` when no tracking flag is on, `pending` until the CNAME resolves, then `verified`. */
  status: "disabled" | "pending" | "verified";
  /** Most recent tracking-CNAME failure, or `null`. */
  verification_failure: VerificationFailure | null;
  /** When the tracking CNAME was last observed resolving, or `null`. */
  verified_at: string | null;
}

/** A sending domain and its mail-flow verification state. */
export interface Domain {
  /** `domain_`-prefixed id. */
  id: string;
  /** The domain name, e.g. `example.com`. */
  name: string;
  /** `pending` until the mail-flow CNAMEs resolve, then `verified`. Tracking issues never affect this. */
  status: "pending" | "verified";
  /** Mail-flow DNS records to publish: one verification CNAME plus one per DKIM selector. */
  dns_records: DnsRecord[];
  /** Most recent mail-flow verification failure, or `null` when verified or never checked. */
  verification_failure: VerificationFailure | null;
  /** Branded tracking configuration and its independent status. */
  tracking: DomainTracking;
  created_at: string;
  /** When the domain most recently transitioned to `verified`, or `null`. */
  verified_at: string | null;
}

/** Body for `domains.create`. */
export interface DomainCreateParams {
  /** The domain name to add, e.g. `example.com`. */
  name: string;
}

/**
 * Body for `domains.update`. Only tracking configuration is mutable; the
 * domain `name` is immutable. Supply only the keys you want to change.
 */
export interface DomainUpdateParams {
  tracking: {
    opens_enabled?: boolean;
    clicks_enabled?: boolean;
    /** Required when either tracking flag is true; pass `null` to clear when both are false. */
    subdomain?: string | null;
  };
}
