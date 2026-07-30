import type { HttpClient } from "../http.js";
import { Page, type PageResponse } from "../pagination.js";
import type { RequestOptions } from "../types/common.js";
import type { Event, EventListParams } from "../types/event.js";

/** Read access to the `/events` stream. List-only — events are not addressable by id. */
export class Events {
  constructor(private readonly http: HttpClient) {}

  /**
   * Page through the team's events, newest-first. The window defaults to the
   * last 24 hours and is clamped to the plan's retention. Returns one
   * {@link Page}; iterate it with `for await` to walk every page. Filter with
   * `start`, `end`, `event_type`, `recipient`, `email_id`, `message_id`,
   * `domain`, `topic`, `campaign`, `template_id`, and `ip_pool`.
   */
  list(
    params?: EventListParams,
    options?: RequestOptions,
  ): Promise<Page<Event>> {
    return this.fetchPage(params, options);
  }

  private async fetchPage(
    params: EventListParams | undefined,
    options: RequestOptions | undefined,
  ): Promise<Page<Event>> {
    const response = await this.http.request<PageResponse<Event>>({
      method: "GET",
      path: "/events",
      query: {
        limit: params?.limit,
        after: params?.after,
        start: params?.start,
        end: params?.end,
        event_type: params?.event_type,
        recipient: params?.recipient,
        email_id: params?.email_id,
        message_id: params?.message_id,
        domain: params?.domain,
        topic: params?.topic,
        campaign: params?.campaign,
        template_id: params?.template_id,
        ip_pool: params?.ip_pool,
        // Sent comma-separated (`tags=a,b`); the API matches with `hasAny`.
        tags: params?.tags?.length ? params.tags.join(",") : undefined,
      },
      ...(options ? { options } : {}),
    });
    return new Page<Event>(response, (after) =>
      this.fetchPage({ ...params, after }, options),
    );
  }
}
