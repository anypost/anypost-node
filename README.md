# Anypost Node SDK

The official TypeScript and JavaScript client for the [Anypost](https://anypost.com) email API.

Runs on Node 18+, Bun, Deno, and edge runtimes. Zero dependencies.

## Install

```bash
npm install anypost
```

## Quickstart

```ts
import { Anypost } from "anypost";

const anypost = new Anypost("ap_your_api_key");

const { id } = await anypost.email.send({
  from: "Acme <you@yourdomain.com>",
  to: ["someone@example.com"],
  subject: "Hello from Anypost",
  html: "<p>It worked.</p>",
});
```

The constructor also reads `ANYPOST_API_KEY` from the environment:

```ts
const anypost = new Anypost();
```

Keep the key server-side. It is a bearer credential; never ship it to a browser or mobile app.

## Sending

One of `text`, `html`, or `template_id` is required. All recipients in `to`, `cc`, and `bcc` share one envelope and count against a combined limit of 50.

```ts
await anypost.email.send({
  from: "Acme <you@yourdomain.com>",
  to: ["a@example.com", "b@example.com"],
  cc: ["team@example.com"],
  reply_to: "support@yourdomain.com",
  subject: "Receipt #4823",
  html: "<p>Thanks for your order.</p>",
  text: "Thanks for your order.",
  tags: ["receipt"],
});
```

Pass attachment `content` as raw bytes and the client base64-encodes it; pass an already-encoded string and it is sent as-is. The request body is capped at 5 MB.

```ts
import { readFileSync } from "node:fs";

await anypost.email.send({
  from: "you@yourdomain.com",
  to: ["someone@example.com"],
  subject: "Your report",
  text: "Attached.",
  attachments: [
    { filename: "report.pdf", content: readFileSync("report.pdf") },
  ],
});
```

Send with a published template and per-recipient variables:

```ts
await anypost.email.send({
  from: "you@yourdomain.com",
  to: ["someone@example.com"],
  template_id: "template_018f2c5e-3a40-7a91-9c25-3a0b1d5e6f78",
  variables: { name: "Ada", plan: "pro" },
});
```

## Batch

Send 1 to 100 independent messages in one request. `defaults` fills any field an entry omits.

```ts
const result = await anypost.email.sendBatch({
  defaults: { from: "you@yourdomain.com" },
  emails: [
    { to: ["a@example.com"], subject: "Hi A", text: "..." },
    { to: ["b@example.com"], subject: "Hi B", text: "..." },
  ],
});
```

A batch with mixed outcomes returns HTTP `207` and resolves normally. Inspect each entry rather than relying on a thrown error:

```ts
console.log(result.summary); // { total, queued, failed }

for (const entry of result.data) {
  if (entry.status === "queued") {
    console.log(entry.index, entry.id);
  } else {
    console.error(entry.index, entry.error.type, entry.error.message);
  }
}
```

## Errors

A failed request throws an `AnypostError` subclass. Branch on `error.type`, the stable machine-readable code, not on the HTTP status.

```ts
import { AnypostError, ValidationError, RateLimitError } from "anypost";

try {
  await anypost.email.send({ from, to, subject, html });
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(err.errors); // { from: ["The from field is required."] }
  } else if (err instanceof RateLimitError) {
    console.error(err.retryAfterMs);
  } else if (err instanceof AnypostError) {
    console.error(err.type, err.status, err.message);
  }
}
```

| Class | `type` | Status |
|---|---|---|
| `ValidationError` | `validation_error` | `400`, `422` |
| `AuthenticationError` | `authentication_error` | `401` |
| `PermissionError` | `permission_error` | `403` |
| `NotFoundError` | `not_found` | `404` |
| `ConflictError` | `idempotency_concurrent`, `webhook_rotation_in_progress` | `409` |
| `IdempotencyMismatchError` | `idempotency_mismatch` | `422` |
| `RateLimitError` | `rate_limit_exceeded` | `429` |
| `PayloadTooLargeError` | `payload_too_large` | `413` |
| `APIError` | `internal_error`, `provisioning_error` | `5xx` |
| `APIConnectionError` | `connection_error` | none |

Every error carries `type`, `status`, `message`, and the parsed `raw` body.

## Retries and idempotency

The client retries `429`, `502`, `503`, and network failures up to `maxRetries` times (default 2), with exponential backoff and full jitter. It honors `Retry-After`.

Sends are made safe to retry automatically: when retries are enabled and you do not pass an `idempotencyKey`, the client generates one and reuses it across attempts, so a retried send cannot deliver twice. Pass your own key to dedupe across process restarts:

```ts
await anypost.email.send(message, { idempotencyKey: orderId });
```

## Configuration

```ts
new Anypost("ap_your_api_key", options);
new Anypost({ apiKey: "ap_your_api_key", ...options });
```

| Option | Default | Description |
|---|---|---|
| `apiKey` | `ANYPOST_API_KEY` | Bearer credential (`ap_...`). |
| `baseUrl` | `https://api.anypost.com/v1` | API base URL. |
| `timeoutMs` | `30000` | Per-request timeout. |
| `maxRetries` | `2` | Automatic retries for transient failures. |
| `fetch` | global `fetch` | Custom fetch implementation. |
| `headers` | `{}` | Extra headers sent on every request. |

Per-call options (`idempotencyKey`, `headers`, `maxRetries`, `timeoutMs`, `signal`) override the client defaults for a single request.

## Roadmap

This release covers sending and identity. Domains, API keys, templates, webhooks, events, and suppressions, along with cursor pagination, land in subsequent releases.

## License

MIT
