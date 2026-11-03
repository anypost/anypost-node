import type { HttpClient } from "../http.js";
import { Page, type PageResponse } from "../pagination.js";
import type { RequestOptions } from "../types/common.js";
import type {
  Suppression,
  SuppressionBatchItem,
  SuppressionBatchResult,
  SuppressionCreateParams,
  SuppressionListParams,
} from "../types/suppression.js";

/** Operations on the `/suppressions` endpoints. Entries key on `(email, topic)`. */
export class Suppressions {
  constructor(private readonly http: HttpClient) {}

  /**
   * List the team's suppressions, newest-first.
   * Returns one {@link Page}; iterate it with `for await` to walk every page.
   * Filter with `email_contains`, `topic`, `reason`, and `origin`.
   */
  list(
    params?: SuppressionListParams,
    options?: RequestOptions,
  ): Promise<Page<Suppression>> {
    return this.fetchPage(params, options);
  }

  /**
   * Add a manual suppression. Defaults to topic `*` (every topic). Throws
   * `validation_error` if an active entry for the same `(email, topic)` exists.
   */
  create(
    params: SuppressionCreateParams,
    options?: RequestOptions,
  ): Promise<Suppression> {
    return this.http.request<Suppression>({
      method: "POST",
      path: "/suppressions",
      body: params,
      ...(options ? { options } : {}),
    });
  }

  /**
   * Add up to 1,000 suppressions in one call. An address already suppressed for
   * the same topic is counted in `already_suppressed` and left unchanged, so a
   * batch is safe to retry; an invalid address comes back in `invalid` instead
   * of failing the batch. Throws `validation_error` (and adds nothing) if the
   * batch would take the team past its suppression limit.
   */
  createBatch(
    suppressions: SuppressionBatchItem[],
    options?: RequestOptions,
  ): Promise<SuppressionBatchResult> {
    return this.http.request<SuppressionBatchResult>({
      method: "POST",
      path: "/suppressions/batch",
      body: { suppressions },
      ...(options ? { options } : {}),
    });
  }

  /**
   * Retrieve the suppression for an `(email, topic)` pair. Use `*` as the topic
   * for the global row. Throws `not_found` if the pair isn't suppressed.
   */
  get(
    email: string,
    topic: string,
    options?: RequestOptions,
  ): Promise<Suppression> {
    return this.http.request<Suppression>({
      method: "GET",
      path: `/suppressions/${encodeURIComponent(email)}/${encodeURIComponent(topic)}`,
      ...(options ? { options } : {}),
    });
  }

  /** Remove the single `(email, topic)` row. Other topics for the address are untouched. */
  delete(
    email: string,
    topic: string,
    options?: RequestOptions,
  ): Promise<void> {
    return this.http.request<void>({
      method: "DELETE",
      path: `/suppressions/${encodeURIComponent(email)}/${encodeURIComponent(topic)}`,
      ...(options ? { options } : {}),
    });
  }

  /**
   * List every suppression on file for an address, across all topics. Throws
   * `not_found` if the address has no active suppressions.
   */
  async listForEmail(
    email: string,
    options?: RequestOptions,
  ): Promise<Suppression[]> {
    const response = await this.http.request<{ data: Suppression[] }>({
      method: "GET",
      path: `/suppressions/${encodeURIComponent(email)}`,
      ...(options ? { options } : {}),
    });
    return response.data;
  }

  /** Remove an address from the suppression list across every topic. */
  deleteForEmail(email: string, options?: RequestOptions): Promise<void> {
    return this.http.request<void>({
      method: "DELETE",
      path: `/suppressions/${encodeURIComponent(email)}`,
      ...(options ? { options } : {}),
    });
  }

  private async fetchPage(
    params: SuppressionListParams | undefined,
    options: RequestOptions | undefined,
  ): Promise<Page<Suppression>> {
    const response = await this.http.request<PageResponse<Suppression>>({
      method: "GET",
      path: "/suppressions",
      query: {
        limit: params?.limit,
        after: params?.after,
        email_contains: params?.email_contains,
        topic: params?.topic,
        reason: params?.reason,
        origin: params?.origin,
      },
      ...(options ? { options } : {}),
    });
    return new Page<Suppression>(response, (after) =>
      this.fetchPage({ ...params, after }, options),
    );
  }
}
