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

## Domains

Manage sending domains under `anypost.domains`. Add a domain, publish the CNAMEs it returns, then verify.

```ts
const domain = await anypost.domains.create({ name: "example.com" });

for (const record of domain.dns_records) {
  console.log(record.type, record.name, "->", record.value);
}
```

`verify` always resolves with the current domain — a still-`pending` domain does not throw. Read `status` and `verification_failure`, and poll while DNS propagates.

```ts
const checked = await anypost.domains.verify(domain.id);
if (checked.status !== "verified") {
  console.log(checked.verification_failure?.code);
}
```

`get`, `update` (tracking config only), and `delete` round out the resource:

```ts
await anypost.domains.update(domain.id, {
  tracking: { opens_enabled: true, clicks_enabled: true, subdomain: "track" },
});
await anypost.domains.delete(domain.id);
```

## API keys

Manage keys under `anypost.apiKeys`. The plaintext secret comes back only once, on `create`, as `key`:

```ts
const created = await anypost.apiKeys.create({
  name: "Production server",
  permissions: "send_only",
  allowed_domains: ["example.com"],
});
console.log(created.key); // store now; never retrievable again

await anypost.apiKeys.update(created.id, {
  name: "Production server",
  permissions: "full",
});
await anypost.apiKeys.delete(created.id);
```

`get` returns metadata only — `key_prefix`, never the secret. Permission and restriction changes take up to 5 minutes to propagate through the gateway cache.

## Templates

Templates use a draft/published model: edits land in a draft, and `publish` promotes it. A template can't be used for sending until it's published.

```ts
const template = await anypost.templates.create({
  name: "Welcome email",
  kind: "html",
  html: "<h1>Welcome, {{ name }}</h1>",
});

await anypost.templates.updateDraft(template.id, {
  subject: "Welcome to Acme",
  html: "<h1>Welcome, {{ name }}</h1>",
});
await anypost.templates.publish(template.id);
```

`kind` is `html` or `markdown` and is immutable once set. The plain-text body is always derived server-side. `getDraft`, `deleteDraft`, `duplicate`, `get`, `update` (name only), and `delete` round out the resource. Send with a published template via `template_id` (see [Sending](#sending)).

## Suppressions

A suppression blocks sends to an address, scoped to a `topic`. The wildcard `*` blocks every topic; a specific topic (e.g. `marketing`) leaves transactional traffic untouched. Bounces and complaints write `*` automatically.

```ts
await anypost.suppressions.create({
  email: "alice@example.com",
  topic: "marketing",
  note: "Customer requested removal",
});

const row = await anypost.suppressions.get("alice@example.com", "*");
await anypost.suppressions.delete("alice@example.com", "marketing");
```

`list` accepts `email_contains`, `topic`, `reason`, and `origin` filters. `listForEmail` returns every row for an address across all topics; `deleteForEmail` removes them all.

```ts
for await (const s of await anypost.suppressions.list({ reason: "complaint" })) {
  console.log(s.email, s.topic, s.suppressed_at);
}
```

## Pagination

List endpoints return a `Page`. Read one page directly, or iterate it with `for await` to walk every page — the client fetches each one as needed.

```ts
const page = await anypost.domains.list({ limit: 50 });
page.data;        // this page's items
page.has_more;    // whether another page exists
page.next_cursor; // pass as `after` to fetch it yourself

for await (const domain of await anypost.domains.list()) {
  console.log(domain.name); // every domain, across all pages
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

This release covers sending, identity, domains, API keys, templates, and suppressions. Webhooks and events land in subsequent releases.

## License

MIT
