import type { Permissions } from "./common.js";

/**
 * The sending limits currently enforced against a team. These are effective
 * values and can differ from the plan defaults, so read them at runtime rather
 * than hardcoding them.
 */
export interface WhoamiLimits {
  /**
   * Messages the team may send per calendar day (UTC). Exceeding it returns
   * 429 with scope `daily`.
   */
  daily: number;
  /**
   * Messages the team may send per billing month. Exceeding it returns 429
   * with scope `monthly`, unless prepaid overage credits cover the excess;
   * those are not counted here.
   */
  monthly: number;
  /**
   * How fast accepted mail is released to receiving servers. Not a request
   * limit and never a rejection: mail beyond this rate queues and drains at
   * the metered rate.
   */
  delivery_rate_per_minute: number;
}

/** The identity resolved from the API key on the request. */
export interface WhoamiResponse {
  /** The team the key belongs to, or `null` if it could not be resolved. */
  team: {
    id: string;
    name: string;
  } | null;
  api_key: {
    id: string;
    permissions: Permissions;
  };
  /** The limits in force for the team, or `null` if it could not be resolved. */
  limits: WhoamiLimits | null;
}
