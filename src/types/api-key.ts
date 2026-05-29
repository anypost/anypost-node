import type { Permissions } from "./common.js";

/** An API key's metadata. The plaintext secret is never returned here. */
export interface ApiKey {
  /** `key_`-prefixed id. */
  id: string;
  name: string;
  /** The first 12 characters of the key, shown for identification. */
  key_prefix: string;
  permissions: Permissions;
  /** Domains this key may send from. `null` means all verified domains. */
  allowed_domains: string[] | null;
  /** IPs or CIDR blocks allowed to use this key. `null` means all IPs. */
  allowed_ips: string[] | null;
  /** When the key was last used, or `null` if never. */
  last_used_at: string | null;
  created_at: string;
}

/** A newly created API key, including its plaintext secret. */
export interface ApiKeyWithSecret extends ApiKey {
  /** The full API key. Returned only once, at creation. Store it securely. */
  key: string;
}

/** Body for `apiKeys.create`. */
export interface ApiKeyCreateParams {
  name: string;
  permissions: Permissions;
  /** Restrict sending to these domains. Omit or `null` for all verified domains. */
  allowed_domains?: string[] | null;
  /** Restrict use to these IPs/CIDRs. Omit or `null` for all IPs. */
  allowed_ips?: string[] | null;
}

/** Body for `apiKeys.update`. The plaintext secret is not rotated here. */
export interface ApiKeyUpdateParams {
  name: string;
  permissions: Permissions;
  /** Pass an empty array or `null` to lift the domain restriction. */
  allowed_domains?: string[] | null;
  /** Pass an empty array or `null` to lift the IP restriction. */
  allowed_ips?: string[] | null;
}
