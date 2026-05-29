import type { HttpClient } from "../http.js";
import { Page, type ListParams, type PageResponse } from "../pagination.js";
import type { RequestOptions } from "../types/common.js";
import type {
  Template,
  TemplateCreateParams,
  TemplateDraft,
  TemplateDraftParams,
  TemplateDuplicateParams,
  TemplateUpdateParams,
} from "../types/template.js";

/** Operations on the `/templates` endpoints, including the draft/publish flow. */
export class Templates {
  constructor(private readonly http: HttpClient) {}

  /**
   * List the team's templates, newest-first. Returns one {@link Page}; iterate
   * it with `for await` to walk every page, or follow `page.next_cursor`.
   */
  list(params?: ListParams, options?: RequestOptions): Promise<Page<Template>> {
    return this.fetchPage(params, options);
  }

  /** Create a template. It starts unpublished — publish it before sending. */
  create(
    params: TemplateCreateParams,
    options?: RequestOptions,
  ): Promise<Template> {
    return this.http.request<Template>({
      method: "POST",
      path: "/templates",
      body: params,
      ...(options ? { options } : {}),
    });
  }

  /** Retrieve a template, including its published content. */
  get(id: string, options?: RequestOptions): Promise<Template> {
    return this.http.request<Template>({
      method: "GET",
      path: `/templates/${encodeURIComponent(id)}`,
      ...(options ? { options } : {}),
    });
  }

  /** Update a template's `name`. Body content lives on the draft. */
  update(
    id: string,
    params: TemplateUpdateParams,
    options?: RequestOptions,
  ): Promise<Template> {
    return this.http.request<Template>({
      method: "PATCH",
      path: `/templates/${encodeURIComponent(id)}`,
      body: params,
      ...(options ? { options } : {}),
    });
  }

  /** Permanently delete a template. */
  delete(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request<void>({
      method: "DELETE",
      path: `/templates/${encodeURIComponent(id)}`,
      ...(options ? { options } : {}),
    });
  }

  /**
   * Copy a template. The copy starts unpublished with a draft seeded from the
   * source's current editable content, and must be published before sending.
   */
  duplicate(
    id: string,
    params?: TemplateDuplicateParams,
    options?: RequestOptions,
  ): Promise<Template> {
    return this.http.request<Template>({
      method: "POST",
      path: `/templates/${encodeURIComponent(id)}/duplicate`,
      ...(params ? { body: params } : {}),
      ...(options ? { options } : {}),
    });
  }

  /** Retrieve the template's unpublished draft. Throws `not_found` if none exists. */
  getDraft(id: string, options?: RequestOptions): Promise<TemplateDraft> {
    return this.http.request<TemplateDraft>({
      method: "GET",
      path: `/templates/${encodeURIComponent(id)}/draft`,
      ...(options ? { options } : {}),
    });
  }

  /** Create or update the template's draft. Idempotent upsert; published content is untouched. */
  updateDraft(
    id: string,
    params: TemplateDraftParams,
    options?: RequestOptions,
  ): Promise<TemplateDraft> {
    return this.http.request<TemplateDraft>({
      method: "PATCH",
      path: `/templates/${encodeURIComponent(id)}/draft`,
      body: params,
      ...(options ? { options } : {}),
    });
  }

  /** Discard the template's draft without touching published content. */
  deleteDraft(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request<void>({
      method: "DELETE",
      path: `/templates/${encodeURIComponent(id)}/draft`,
      ...(options ? { options } : {}),
    });
  }

  /** Promote the draft into the published slot, consuming the draft. */
  publish(id: string, options?: RequestOptions): Promise<Template> {
    return this.http.request<Template>({
      method: "POST",
      path: `/templates/${encodeURIComponent(id)}/publish`,
      ...(options ? { options } : {}),
    });
  }

  private async fetchPage(
    params: ListParams | undefined,
    options: RequestOptions | undefined,
  ): Promise<Page<Template>> {
    const response = await this.http.request<PageResponse<Template>>({
      method: "GET",
      path: "/templates",
      query: { limit: params?.limit, after: params?.after },
      ...(options ? { options } : {}),
    });
    return new Page<Template>(response, (after) =>
      this.fetchPage({ ...params, after }, options),
    );
  }
}
