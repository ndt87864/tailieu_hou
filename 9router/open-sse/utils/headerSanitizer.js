/**
 * Sanitize outgoing HTTP header values so they can be converted to ByteString.
 * Web APIs reject header values containing code points > 255.
 */
export function sanitizeHeaderValue(value) {
  if (value === undefined || value === null) return value;
  return String(value).replace(/[^\x00-\xFF]/g, "").trim();
}

export function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== "object") return headers;
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = typeof value === "string" ? sanitizeHeaderValue(value) : value;
  }
  return out;
}
