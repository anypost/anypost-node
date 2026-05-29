import {
  AnypostError,
  APIConnectionError,
  parseError,
  retryAfterMs,
} from "./errors.js";
import type { RequestOptions } from "./types/common.js";
import { SDK_VERSION } from "./version.js";

export type FetchLike = typeof fetch;

export interface HttpConfig {
  apiKey: string;
  /** Normalized base URL, no trailing slash. */
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  fetch: FetchLike;
  defaultHeaders: Record<string, string>;
}

export interface RequestParams {
  method: string;
  /** Path under the base URL, e.g. `/email`. */
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Whether this endpoint accepts an `Idempotency-Key`. */
  idempotent?: boolean;
  options?: RequestOptions;
}

const RETRYABLE_STATUS = new Set([429, 502, 503]);
const MAX_BACKOFF_MS = 8000;
const BASE_BACKOFF_MS = 500;

export class HttpClient {
  constructor(private readonly config: HttpConfig) {}

  async request<T>(params: RequestParams): Promise<T> {
    const { method, path, body, query, idempotent, options } = params;
    const url = this.buildUrl(path, query);
    const maxRetries = options?.maxRetries ?? this.config.maxRetries;
    const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs;
    const headers = this.buildHeaders({
      hasBody: body !== undefined,
      idempotent: idempotent === true,
      maxRetries,
      options,
    });
    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    let attempt = 0;
    // attempt counts the try number; up to maxRetries retries after the first.
    for (;;) {
      const { signal, dispose } = makeSignal(timeoutMs, options?.signal);
      try {
        const init: RequestInit = { method, headers, signal };
        if (payload !== undefined) init.body = payload;
        const response = await this.config.fetch(url, init);

        if (response.ok) {
          return (await readJson(response)) as T;
        }

        const errorBody = await readJson(response);
        if (RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
          await sleep(backoffMs(attempt, response.headers));
          attempt += 1;
          continue;
        }
        throw parseError(response.status, errorBody, response.headers);
      } catch (err) {
        // A thrown HTTP error (from parseError) is terminal; rethrow it.
        if (err instanceof AnypostError) throw err;
        // Network failure, timeout, or abort — no HTTP response.
        if (attempt < maxRetries && !isExternalAbort(err, options?.signal)) {
          await sleep(backoffMs(attempt, undefined));
          attempt += 1;
          continue;
        }
        throw new APIConnectionError(connectionMessage(err), err);
      } finally {
        dispose();
      }
    }
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(this.config.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private buildHeaders(opts: {
    hasBody: boolean;
    idempotent: boolean;
    maxRetries: number;
    options: RequestOptions | undefined;
  }): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      Accept: "application/json",
      "User-Agent": userAgent(),
      ...this.config.defaultHeaders,
    };
    if (opts.hasBody) headers["Content-Type"] = "application/json";

    if (opts.idempotent) {
      const key = opts.options?.idempotencyKey;
      if (key) {
        headers["Idempotency-Key"] = key;
      } else if (opts.maxRetries > 0) {
        // Auto-key so built-in retries of a send cannot deliver twice.
        headers["Idempotency-Key"] = randomUUID();
      }
    }

    if (opts.options?.headers) Object.assign(headers, opts.options.headers);
    return headers;
  }
}

function isExternalAbort(err: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true &&
    err instanceof Error &&
    err.name === "AbortError"
  );
}

function connectionMessage(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") {
    return "Request timed out or was aborted before a response.";
  }
  const detail = err instanceof Error ? err.message : String(err);
  return `Could not reach Anypost: ${detail}`;
}

function backoffMs(attempt: number, headers: Headers | undefined): number {
  if (headers) {
    const after = retryAfterMs(headers);
    if (after !== null) return Math.min(after, MAX_BACKOFF_MS);
  }
  const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return Math.random() * ceiling; // full jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface DisposableSignal {
  signal: AbortSignal;
  dispose: () => void;
}

function makeSignal(
  timeoutMs: number,
  external?: AbortSignal,
): DisposableSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

function randomUUID(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback for runtimes without WebCrypto's randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function userAgent(): string {
  const g = globalThis as Record<string, unknown>;
  let runtime = "";
  const bun = g.Bun as { version?: string } | undefined;
  const deno = g.Deno as { version?: { deno?: string } } | undefined;
  if (bun?.version) runtime = ` Bun/${bun.version}`;
  else if (deno?.version?.deno) runtime = ` Deno/${deno.version.deno}`;
  else if (typeof process !== "undefined" && process.versions?.node) {
    runtime = ` Node/${process.versions.node}`;
  }
  return `anypost-node/${SDK_VERSION}${runtime}`;
}
