import { HttpClient, type FetchLike } from "./http.js";
import { Email } from "./resources/email.js";
import { Identity } from "./resources/identity.js";
import type { RequestOptions } from "./types/common.js";
import type { WhoamiResponse } from "./types/identity.js";

const DEFAULT_BASE_URL = "https://api.anypost.com/v1";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

export interface AnypostOptions {
  /** API key (`ap_...`). Falls back to `ANYPOST_API_KEY` when omitted. */
  apiKey?: string;
  /** Override the API base URL. Defaults to the production endpoint. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default 30000. */
  timeoutMs?: number;
  /** Automatic retries for transient failures. Default 2. */
  maxRetries?: number;
  /** A custom `fetch` implementation. Defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** Extra headers sent on every request. */
  headers?: Record<string, string>;
}

/** Client for the Anypost email API. */
export class Anypost {
  /** Send operations (`/email`, `/email/batch`). */
  readonly email: Email;
  private readonly identity: Identity;

  constructor(apiKey: string, options?: AnypostOptions);
  constructor(options: AnypostOptions);
  constructor(apiKeyOrOptions?: string | AnypostOptions, options?: AnypostOptions) {
    const opts: AnypostOptions =
      typeof apiKeyOrOptions === "string"
        ? { ...options, apiKey: apiKeyOrOptions }
        : (apiKeyOrOptions ?? {});

    const apiKey = opts.apiKey ?? readEnvApiKey();
    if (!apiKey) {
      throw new Error(
        "An Anypost API key is required. Pass it to the constructor or set ANYPOST_API_KEY.",
      );
    }

    const fetchImpl = resolveFetch(opts.fetch);
    const http = new HttpClient({
      apiKey,
      baseUrl: normalizeBaseUrl(opts.baseUrl ?? DEFAULT_BASE_URL),
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: opts.maxRetries ?? DEFAULT_MAX_RETRIES,
      fetch: fetchImpl,
      defaultHeaders: opts.headers ?? {},
    });

    this.email = new Email(http);
    this.identity = new Identity(http);
  }

  /** Identify the team and permission level behind the current API key. */
  whoami(options?: RequestOptions): Promise<WhoamiResponse> {
    return this.identity.whoami(options);
  }
}

function readEnvApiKey(): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env.ANYPOST_API_KEY;
  }
  return undefined;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveFetch(custom?: FetchLike): FetchLike {
  if (custom) return custom;
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }
  throw new Error(
    "No global fetch found. Use Node 18+, Bun, Deno, or pass a custom `fetch`.",
  );
}
