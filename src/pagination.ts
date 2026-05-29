/** Shared query parameters for every list endpoint. */
export interface ListParams {
  /** Items per page, 1-100. Defaults to 20 server-side. */
  limit?: number;
  /** A cursor from a previous page's `next_cursor`. Opaque — do not parse. */
  after?: string;
}

/** The raw envelope every list endpoint returns. */
export interface PageResponse<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

/** Fetches the page that begins at `after`. */
export type PageFetcher<T> = (after: string) => Promise<Page<T>>;

/**
 * One page of a list result. Mirrors the wire envelope (`data`, `has_more`,
 * `next_cursor`) and is async-iterable: iterating walks every remaining page
 * automatically, re-fetching with `after = next_cursor`.
 *
 * ```ts
 * const page = await anypost.domains.list();   // one page; cursor via page.next_cursor
 * for (const d of page.data) { ... }
 *
 * for await (const d of await anypost.domains.list()) { ... }  // every domain
 * ```
 */
export class Page<T> implements AsyncIterable<T> {
  readonly data: T[];
  readonly has_more: boolean;
  readonly next_cursor: string | null;
  private readonly fetchNext: PageFetcher<T>;

  constructor(response: PageResponse<T>, fetchNext: PageFetcher<T>) {
    this.data = response.data;
    this.has_more = response.has_more;
    this.next_cursor = response.next_cursor;
    this.fetchNext = fetchNext;
  }

  /** Fetch the next page, or `null` when there are no more. */
  async getNextPage(): Promise<Page<T> | null> {
    if (!this.has_more || this.next_cursor === null) return null;
    return this.fetchNext(this.next_cursor);
  }

  /** Iterate every item across every remaining page. */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let page: Page<T> | null = this;
    while (page) {
      for (const item of page.data) yield item;
      page = await page.getNextPage();
    }
  }
}
