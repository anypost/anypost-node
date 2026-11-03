# Anypost Node SDK

The official TypeScript and JavaScript client for the [Anypost](https://anypost.com) email API.

Runs on Node 18+, Bun, Deno, and edge runtimes. Zero dependencies.

This README covers the SDK itself: installation, idioms, and configuration. For platform concepts and the full field-level API reference, see the [Anypost documentation](https://anypost.com/docs).

## Install

```bash
npm install anypost
```

## Quickstart

```ts
import { Anypost } from "anypost";

const anypost = new Anypost("ap_your_api_key");

const { id } = await anypost.email.send({
  from: "YourCo <you@yourdomain.com>",
  to: ["you@example.com"],
  subject: "Welcome to Anypost",
  html: "<p>Hello, inbox!</p>",
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
  from: "YourCo <you@yourdomain.com>",
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
  from: "YourCo <you@yourdomain.com>",
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
  from: "YourCo <you@yourdomain.com>",
  to: ["someone@example.com"],
  template_id: "template_018f2c5e-3a40-7a91-9c25-3a0b1d5e6f78",
  variables: { name: "Ada", plan: "pro" },
});
```

See the [send reference](https://anypost.com/docs/reference/emails) for the complete field list.

## Markdown

Write the body in Markdown and the SDK renders it to email-safe HTML and a plain-text alternative through [`emailmd`](https://www.emailmd.dev). Pass `markdown` in place of `html`/`text`:

```ts
await anypost.email.send({
  from: "YourCo <you@yourdomain.com>",
  to: ["someone@example.com"],
  subject: "Welcome",
  markdown: "# Welcome\n\nThanks for signing up. [Get started](https://app.example.com).",
});
```

`emailmd` is an optional peer dependency. Install it only if you send Markdown:

```bash
npm install emailmd
```

It requires Node 20+ and does not run in edge or browser runtimes, so the rest of the SDK stays dependency-free and portable. Calling a Markdown path without `emailmd` installed throws a clear error.

Pass render options (theme, fonts, validation) through `markdownOptions`, and reach the renderer directly with `renderMarkdown` to render once and reuse the result, or to read the extracted frontmatter:

```ts
import { renderMarkdown } from "anypost";

const { html, text, meta } = await renderMarkdown("# Hi", {
  theme: { brandColor: "#4f46e5" },
});
// meta.preheader, etc.
```

`markdown` cannot be combined with `html` or `text`. In a batch, set `markdownOptions` on `defaults` to apply one theme to every entry's render.

## Batch

Send 1 to 100 independent messages in one request. `defaults` fills any field an entry omits.

```ts
const result = await anypost.email.sendBatch({
  defaults: { from: "YourCo <you@yourdomain.com>" },
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
  } else if (entry.error.type === "quota_exceeded") {
    // A label cap denied this entry. Narrowing on `type` reaches the denial
    // detail, so there is no need to parse the message.
    retryAfter(entry.index, entry.error.scope, entry.error.retry_after_seconds);
  } else {
    console.error(entry.index, entry.error.type, entry.error.message);
  }
}
```

## Domains

Manage sending domains under `anypost.domains`. Add a domain, publish the DNS records it returns, then verify.

```ts
const domain = await anypost.domains.create({ name: "example.com" });

for (const record of domain.dns_records) {
  console.log(record.type, record.name, "->", record.value);
}

const checked = await anypost.domains.verify(domain.id);
if (checked.status !== "verified") {
  // verify resolves with the current domain even while pending; it never throws
  console.log(checked.verification_failure?.code);
}
```

`get`, `update` (tracking config only), and `delete` round out the resource. See [Domains](https://anypost.com/docs/reference/domains) for the verification lifecycle and field reference.

## API keys

Manage keys under `anypost.apiKeys`. The plaintext secret comes back only once, on `create`, as `key`, so store it then.

```ts
const created = await anypost.apiKeys.create({
  name: "Production server",
  permissions: "send_only",
  allowed_domains: ["example.com"],
});
console.log(created.key); // never retrievable again
```

`get` returns metadata only (`key_prefix`, never the secret); `update` and `delete` round out the resource. See [API keys](https://anypost.com/docs/reference/api-keys) for the permission model and cache propagation.

## Templates

Templates use a draft/published model: edits land in a draft, and `publish` promotes it. A template can't be used for sending until it's published.

```ts
const template = await anypost.templates.create({
  name: "Welcome email",
  kind: "html",
  html: "<h1>Welcome, {{ name }}</h1>",
});

await anypost.templates.publish(template.id);
```

`kind` (`html` or `markdown`) is immutable once set; the plain-text body is always derived server-side. `getDraft`, `updateDraft`, `deleteDraft`, `duplicate`, `get`, `update` (name only), and `delete` round out the resource. Send a published template with `template_id` (see [Sending](#sending)). See [Templates](https://anypost.com/docs/reference/templates) for the full model.

## Suppressions

A suppression blocks sends to an address, scoped to a `topic`. The wildcard `*` blocks every topic; a named topic (e.g. `marketing`) leaves transactional traffic untouched.

```ts
await anypost.suppressions.create({
  email: "alice@example.com",
  topic: "marketing",
  note: "Customer requested removal",
});

await anypost.suppressions.delete("alice@example.com", "marketing");
```

Add up to 1,000 at a time with `createBatch`, for example when moving a list over from another provider:

```ts
const result = await anypost.suppressions.createBatch([
  { email: "alice@example.com", reason: "hard bounce" },
  { email: "bob@example.com", topic: "marketing", reason: "unsubscribed" },
]);
// { imported: 2, already_suppressed: 0, invalid: [] }
```

Addresses already suppressed for that topic are counted in `already_suppressed` and left unchanged, so a batch is safe to retry. Invalid addresses come back in `invalid` with their position instead of failing the batch.

`get`, `list` (with `email_contains`, `topic`, `reason`, and `origin` filters), `listForEmail`, and `deleteForEmail` round out the resource. See [Suppressions](https://anypost.com/docs/reference/suppressions) for scoping and the automatic-suppression rules for bounces and complaints.

## Webhooks

Manage webhook subscriptions under `anypost.webhooks`. The `signing_secret` comes back only once, on `create`; later reads return only `signing_secret_prefix`.

```ts
const webhook = await anypost.webhooks.create({
  name: "Production events",
  url: "https://hooks.example.com/anypost",
  events: ["email.delivered", "email.bounced", "email.complained"],
});
console.log(webhook.signing_secret); // store now; never retrievable again
```

`update`, `test`, `rotateSecret`, `get`, `list`, and `delete` round out the resource. See [Webhooks](https://anypost.com/docs/reference/webhooks) for the event catalog, status transitions, and the secret-rotation grace window.

### Verifying deliveries

`verifyWebhookSignature` is a standalone function. It needs the signing secret, not an API key, so call it in your handler without a client. Pass the **raw** request body (the exact bytes, before JSON parsing), the `Anypost-Signature` header, and the secret. It resolves on success and throws `WebhookVerificationError` otherwise. `unwrapWebhookEvent` does the same and returns the parsed `WebhookDelivery`.

```ts
import { unwrapWebhookEvent, WebhookVerificationError } from "anypost";

try {
  const delivery = await unwrapWebhookEvent(rawBody, signatureHeader, secret);
  for (const event of delivery.events) {
    console.log(event.type, event.data.email_id);
  }
} catch (err) {
  if (err instanceof WebhookVerificationError) {
    // err.reason: "no_match" | "timestamp_out_of_tolerance" | ...
    return res.status(400).end();
  }
  throw err;
}
```

Reach for `verifyWebhookSignature` when something else has already parsed the body. Keep the raw bytes for the verify step (a captured `req.rawBody`, say), then use your framework's parsed object once it passes:

```ts
import { verifyWebhookSignature, WebhookVerificationError } from "anypost";

app.post("/anypost", async (req, res) => {
  try {
    await verifyWebhookSignature(req.rawBody, req.header("Anypost-Signature"), secret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) return res.status(400).end();
    throw err;
  }
  for (const event of req.body.events) handle(event); // req.body is already parsed
  res.status(204).end();
});
```

Deliveries older than five minutes are rejected by default to bound replay; pass `toleranceSeconds` to widen, narrow, or disable that check. During a secret rotation the header carries a `v1=` component per active secret, and a match on any one passes, so deliveries keep verifying while you redeploy.

## Events

`anypost.events.list` pages the team's event stream, newest-first. The window defaults to the last 24 hours and is clamped to your plan's retention. Events are read-only and not addressable by id, so there is no `get`.

```ts
for await (const event of await anypost.events.list({ event_type: "email.bounced" })) {
  console.log(event.occurred_at, event.recipient, event.bounce_classification);
}
```

Filter by `start`, `end`, `event_type`, `recipient`, `email_id`, `message_id`, `domain`, `topic`, `campaign`, `template_id`, `ip_pool`, and `tags`, a `string[]` that matches an event carrying *any* of the given tags. Every other filter is exact-match. This is also how you backfill the gap after a webhook endpoint was disabled: page the events that occurred during the outage once it's healthy. See [Events](https://anypost.com/docs/reference/events) for the field reference.

## Pagination

List endpoints return a `Page`. Read one page directly, or iterate it with `for await` to walk every page; the client fetches each one as needed.

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
| `ConflictError` | `conflict`, `idempotency_concurrent`, `webhook_rotation_in_progress` | `409` |
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

## License

MIT
