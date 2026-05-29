/** Authoring format. Immutable once a template exists. */
export type TemplateKind = "html" | "markdown";

/**
 * A reusable email template. The `subject`/`html`/`text`/`markdown` fields hold
 * the *published* content and are `null` until the template is first published.
 * Edits land in a draft (see `templates.getDraft`); `templates.publish` promotes
 * the draft into the published slot. Sends always use the published content.
 */
export interface Template {
  /** `template_`-prefixed id. */
  id: string;
  /** Identifier for the template, unique within the team. */
  name: string;
  /** Published subject line. `null` until first published. */
  subject: string | null;
  kind: TemplateKind;
  /** Published HTML body. `null` until first published. */
  html: string | null;
  /** Published plain-text body, always machine-derived. `null` until first published. */
  text: string | null;
  /** Published emailmd source. Only set for `kind=markdown`, else `null`. */
  markdown: string | null;
  /** Whether an unpublished draft is pending. */
  has_draft: boolean;
  /** When last published, or `null` if never (the template holds no sendable content). */
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The unpublished draft content for a template. */
export interface TemplateDraft {
  subject: string | null;
  html: string | null;
  /** Always machine-derived from the draft's `html`/`markdown`; never set directly. */
  text: string | null;
  markdown: string | null;
  updated_at: string;
}

/**
 * Body for `templates.create`. The new template starts unpublished and must be
 * published before sending. For `kind=html` supply `html`; for `kind=markdown`
 * supply `markdown`. The plain-text body is always derived server-side.
 */
export interface TemplateCreateParams {
  name: string;
  subject?: string | null;
  /** Defaults to `html`. Immutable once the template exists. */
  kind?: TemplateKind;
  html?: string | null;
  markdown?: string | null;
}

/** Body for `templates.update`. Only `name` is mutable; content is draft-versioned. */
export interface TemplateUpdateParams {
  name: string;
}

/**
 * Body for `templates.updateDraft`. Idempotent upsert of the draft. For
 * `kind=html` supply `html`; for `kind=markdown` supply `markdown`.
 */
export interface TemplateDraftParams {
  subject?: string | null;
  html?: string | null;
  markdown?: string | null;
}

/** Body for `templates.duplicate`. */
export interface TemplateDuplicateParams {
  /** Name for the copy. Defaults to `"<source name> (copy)"` when omitted. */
  name?: string;
}
