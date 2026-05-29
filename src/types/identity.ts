import type { Permissions } from "./common.js";

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
}
