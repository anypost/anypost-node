export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface ResponseSpec {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** When set, the fetch call rejects with this error (simulates a network failure). */
  throwError?: Error;
}

type SpecSource = ResponseSpec[] | ((req: RecordedRequest, call: number) => ResponseSpec);

export interface MockFetch {
  fetch: typeof fetch;
  calls: RecordedRequest[];
}

/** A `fetch` stand-in that records requests and replays scripted responses. */
export function mockFetch(source: SpecSource): MockFetch {
  const calls: RecordedRequest[] = [];

  const impl = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const record: RecordedRequest = {
      url,
      method: init?.method ?? "GET",
      headers,
      body,
    };
    const index = calls.length;
    calls.push(record);

    const spec = Array.isArray(source)
      ? (source[Math.min(index, source.length - 1)] as ResponseSpec)
      : source(record, index);

    if (spec.throwError) throw spec.throwError;
    return buildResponse(spec);
  };

  return { fetch: impl as typeof fetch, calls };
}

function buildResponse(spec: ResponseSpec): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const [key, value] of Object.entries(spec.headers ?? {})) {
    headers.set(key, value);
  }
  const body =
    spec.status === 204 || spec.body === undefined
      ? null
      : JSON.stringify(spec.body);
  return new Response(body, { status: spec.status, headers });
}
