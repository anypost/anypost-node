import type { HttpClient } from "../http.js";
import { Page, type ListParams, type PageResponse } from "../pagination.js";
import type { RequestOptions } from "../types/common.js";
import type {
  Webhook,
  WebhookCreateParams,
  WebhookTestResult,
  WebhookUpdateParams,
  WebhookWithSecret,
} from "../types/webhook.js";

/** Operations on the `/webhooks` endpoints. */
export class Webhooks {
  constructor(private readonly http: HttpClient) {}

  /**
   * List the team's webhooks, newest-first. Returns one {@link Page}; iterate
   * it with `for await` to walk every page, or follow `page.next_cursor`.
   */
  list(params?: ListParams, options?: RequestOptions): Promise<Page<Webhook>> {
    return this.fetchPage(params, options);
  }

  /**
   * Create a webhook. The full `signing_secret` is on the response to this call
   * only — store it now to verify future deliveries; later reads return only
   * the prefix.
   */
  create(
    params: WebhookCreateParams,
    options?: RequestOptions,
  ): Promise<WebhookWithSecret> {
    return this.http.request<WebhookWithSecret>({
      method: "POST",
      path: "/webhooks",
      body: params,
      ...(options ? { options } : {}),
    });
  }

  /** Retrieve a webhook. The signing secret is never returned — only its prefix. */
  get(id: string, options?: RequestOptions): Promise<Webhook> {
    return this.http.request<Webhook>({
      method: "GET",
      path: `/webhooks/${encodeURIComponent(id)}`,
      ...(options ? { options } : {}),
    });
  }

  /**
   * Update a webhook's name, URL, subscribed events, and status. This does not
   * rotate the signing secret — use {@link rotateSecret} for that.
   */
  update(
    id: string,
    params: WebhookUpdateParams,
    options?: RequestOptions,
  ): Promise<Webhook> {
    return this.http.request<Webhook>({
      method: "PATCH",
      path: `/webhooks/${encodeURIComponent(id)}`,
      body: params,
      ...(options ? { options } : {}),
    });
  }

  /** Permanently delete a webhook. */
  delete(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request<void>({
      method: "DELETE",
      path: `/webhooks/${encodeURIComponent(id)}`,
      ...(options ? { options } : {}),
    });
  }

  /**
   * Send a single synthetic `webhook.test` event to the endpoint and report the
   * outcome. One-shot, not retried, and absent from delivery history. Resolves
   * with the result even when the endpoint fails — read `delivered` and
   * `status_code`. Works on a `disabled` webhook too.
   */
  test(id: string, options?: RequestOptions): Promise<WebhookTestResult> {
    return this.http.request<WebhookTestResult>({
      method: "POST",
      path: `/webhooks/${encodeURIComponent(id)}/test`,
      ...(options ? { options } : {}),
    });
  }

  /**
   * Rotate the signing secret. The new secret is on this response only. The
   * previous secret stays valid for a 24h grace window, during which deliveries
   * carry a `v1=` component for each. Rotating again before the window ends
   * throws `webhook_rotation_in_progress` (a `ConflictError`).
   */
  rotateSecret(id: string, options?: RequestOptions): Promise<WebhookWithSecret> {
    return this.http.request<WebhookWithSecret>({
      method: "POST",
      path: `/webhooks/${encodeURIComponent(id)}/rotate-secret`,
      ...(options ? { options } : {}),
    });
  }

  private async fetchPage(
    params: ListParams | undefined,
    options: RequestOptions | undefined,
  ): Promise<Page<Webhook>> {
    const response = await this.http.request<PageResponse<Webhook>>({
      method: "GET",
      path: "/webhooks",
      query: { limit: params?.limit, after: params?.after },
      ...(options ? { options } : {}),
    });
    return new Page<Webhook>(response, (after) =>
      this.fetchPage({ ...params, after }, options),
    );
  }
}
