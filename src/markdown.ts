import type { MarkdownOptions } from "./types/email.js";

/** Result of rendering markdown through `emailmd`. */
export interface MarkdownRenderResult {
  /** Complete, email-safe HTML document for the `text/html` part. */
  html: string;
  /** Plain-text alternative for the `text/plain` part. */
  text: string;
  /** Extracted frontmatter (`preheader` and any custom keys). */
  meta: Record<string, unknown>;
  /** Non-fatal issues raised while rendering, if any. */
  warnings?: unknown[];
}

/** The single function the SDK uses from `emailmd`; declared locally so emailmd's types are never required. */
interface EmailmdModule {
  render(markdown: string, options?: MarkdownOptions): Promise<MarkdownRenderResult>;
}

let cached: Promise<EmailmdModule> | undefined;

function loadEmailmd(): Promise<EmailmdModule> {
  if (!cached) {
    // Dynamic so emailmd stays optional: importing the SDK never loads it, and
    // edge/browser builds (where MJML cannot run) are unaffected unless markdown
    // is actually used.
    cached = import("emailmd")
      .then((mod) => mod as unknown as EmailmdModule)
      .catch((cause) => {
        cached = undefined; // let a later call retry once the package is installed
        throw new Error(
          "Markdown email support needs the optional \"emailmd\" package. " +
            "Install it with `npm install emailmd` (requires Node 20+).",
          { cause },
        );
      });
  }
  return cached;
}

/**
 * Render markdown to email-safe HTML and a plain-text alternative using the
 * optional [`emailmd`](https://www.emailmd.dev) package.
 *
 * {@link Email.send} and {@link Email.sendBatch} call this for you when you pass
 * a `markdown` field. Call it directly to render once and reuse the result
 * across many sends, or to inspect the extracted `meta`/`warnings`.
 *
 * Throws if `emailmd` is not installed.
 */
export async function renderMarkdown(
  markdown: string,
  options?: MarkdownOptions,
): Promise<MarkdownRenderResult> {
  const { render } = await loadEmailmd();
  return render(markdown, options);
}
