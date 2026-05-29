/**
 * Minimal send example.
 *
 *   ANYPOST_API_KEY=ap_... bun run examples/send.ts
 *
 * Point at a non-production gateway with ANYPOST_BASE_URL.
 */
import { Anypost, AnypostError } from "../src/index.js";

const anypost = new Anypost({
  ...(process.env.ANYPOST_BASE_URL
    ? { baseUrl: process.env.ANYPOST_BASE_URL }
    : {}),
});

try {
  const { id } = await anypost.email.send({
    from: "Acme <you@yourdomain.com>",
    to: ["someone@example.com"],
    subject: "Hello from Anypost",
    text: "It worked.",
  });
  console.log("queued", id);
} catch (err) {
  if (err instanceof AnypostError) {
    console.error(`send failed (${err.type}, ${err.status}):`, err.message);
    process.exitCode = 1;
  } else {
    throw err;
  }
}
