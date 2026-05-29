/** Base64-encode raw bytes. Works on Node, Bun, Deno, edge, and browsers. */
export function bytesToBase64(bytes: Uint8Array): string {
  // Node and Bun: Buffer is the fastest path and handles large inputs directly.
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  // Deno, edge, browsers: btoa over a binary string, chunked so a large
  // attachment does not blow the argument limit of String.fromCharCode.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
