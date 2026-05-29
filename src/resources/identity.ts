import type { HttpClient } from "../http.js";
import type { RequestOptions } from "../types/common.js";
import type { WhoamiResponse } from "../types/identity.js";

/** Identity operations. */
export class Identity {
  constructor(private readonly http: HttpClient) {}

  /** Identify the team and permission level behind the current API key. */
  whoami(options?: RequestOptions): Promise<WhoamiResponse> {
    return this.http.request<WhoamiResponse>({
      method: "GET",
      path: "/whoami",
      ...(options ? { options } : {}),
    });
  }
}
