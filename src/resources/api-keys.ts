import type { HttpClient } from "../http.js";
import { Page, type ListParams, type PageResponse } from "../pagination.js";
import type {
  ApiKey,
  ApiKeyCreateParams,
  ApiKeyUpdateParams,
  ApiKeyWithSecret,
} from "../types/api-key.js";
import type { RequestOptions } from "../types/common.js";

/** Operations on the `/api-keys` endpoints. */
export class ApiKeys {
  constructor(private readonly http: HttpClient) {}

  /**
   * List the team's API keys, newest-first. Returns one {@link Page}; iterate it
   * with `for await` to walk every page, or follow `page.next_cursor` yourself.
   */
  list(params?: ListParams, options?: RequestOptions): Promise<Page<ApiKey>> {
    return this.fetchPage(params, options);
  }

  /**
   * Issue a new API key. The plaintext secret is returned only in this
   * response, as `key` — store it securely; it cannot be retrieved later.
   */
  create(
    params: ApiKeyCreateParams,
    options?: RequestOptions,
  ): Promise<ApiKeyWithSecret> {
    return this.http.request<ApiKeyWithSecret>({
      method: "POST",
      path: "/api-keys",
      body: params,
      ...(options ? { options } : {}),
    });
  }

  /** Retrieve a single API key's metadata. The secret is never returned. */
  get(id: string, options?: RequestOptions): Promise<ApiKey> {
    return this.http.request<ApiKey>({
      method: "GET",
      path: `/api-keys/${encodeURIComponent(id)}`,
      ...(options ? { options } : {}),
    });
  }

  /**
   * Update a key's name, permissions, and domain/IP restrictions. The secret
   * is not rotated here. Permission and restriction changes may take up to 5
   * minutes to propagate through the gateway cache.
   */
  update(
    id: string,
    params: ApiKeyUpdateParams,
    options?: RequestOptions,
  ): Promise<ApiKey> {
    return this.http.request<ApiKey>({
      method: "PATCH",
      path: `/api-keys/${encodeURIComponent(id)}`,
      body: params,
      ...(options ? { options } : {}),
    });
  }

  /**
   * Delete a key. A deleted key may continue to authenticate for up to 5
   * minutes due to gateway caching.
   */
  delete(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request<void>({
      method: "DELETE",
      path: `/api-keys/${encodeURIComponent(id)}`,
      ...(options ? { options } : {}),
    });
  }

  private async fetchPage(
    params: ListParams | undefined,
    options: RequestOptions | undefined,
  ): Promise<Page<ApiKey>> {
    const response = await this.http.request<PageResponse<ApiKey>>({
      method: "GET",
      path: "/api-keys",
      query: { limit: params?.limit, after: params?.after },
      ...(options ? { options } : {}),
    });
    return new Page<ApiKey>(response, (after) =>
      this.fetchPage({ ...params, after }, options),
    );
  }
}
