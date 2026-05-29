import type { HttpClient } from "../http.js";
import { Page, type ListParams, type PageResponse } from "../pagination.js";
import type { RequestOptions } from "../types/common.js";
import type {
  Domain,
  DomainCreateParams,
  DomainUpdateParams,
} from "../types/domain.js";

/** Operations on the `/domains` endpoints. */
export class Domains {
  constructor(private readonly http: HttpClient) {}

  /**
   * List the team's domains, newest-first. Returns one {@link Page}; iterate it
   * with `for await` to walk every page, or follow `page.next_cursor` yourself.
   */
  list(params?: ListParams, options?: RequestOptions): Promise<Page<Domain>> {
    return this.fetchPage(params, options);
  }

  /** Add a sending domain. The returned domain is `pending` until verified. */
  create(params: DomainCreateParams, options?: RequestOptions): Promise<Domain> {
    return this.http.request<Domain>({
      method: "POST",
      path: "/domains",
      body: params,
      ...(options ? { options } : {}),
    });
  }

  /** Retrieve a single domain by id. */
  get(id: string, options?: RequestOptions): Promise<Domain> {
    return this.http.request<Domain>({
      method: "GET",
      path: `/domains/${encodeURIComponent(id)}`,
      ...(options ? { options } : {}),
    });
  }

  /** Update a domain's tracking configuration. The domain `name` is immutable. */
  update(
    id: string,
    params: DomainUpdateParams,
    options?: RequestOptions,
  ): Promise<Domain> {
    return this.http.request<Domain>({
      method: "PATCH",
      path: `/domains/${encodeURIComponent(id)}`,
      body: params,
      ...(options ? { options } : {}),
    });
  }

  /** Permanently delete a domain and its DKIM keys. */
  delete(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request<void>({
      method: "DELETE",
      path: `/domains/${encodeURIComponent(id)}`,
      ...(options ? { options } : {}),
    });
  }

  /**
   * Trigger a verification check. Always resolves with the current domain —
   * read `status` and `verification_failure` to learn the outcome; a still-
   * `pending` domain does not throw. Safe to poll while DNS propagates.
   */
  verify(id: string, options?: RequestOptions): Promise<Domain> {
    return this.http.request<Domain>({
      method: "POST",
      path: `/domains/${encodeURIComponent(id)}/verify`,
      ...(options ? { options } : {}),
    });
  }

  private async fetchPage(
    params: ListParams | undefined,
    options: RequestOptions | undefined,
  ): Promise<Page<Domain>> {
    const response = await this.http.request<PageResponse<Domain>>({
      method: "GET",
      path: "/domains",
      query: { limit: params?.limit, after: params?.after },
      ...(options ? { options } : {}),
    });
    return new Page<Domain>(response, (after) =>
      this.fetchPage({ ...params, after }, options),
    );
  }
}
