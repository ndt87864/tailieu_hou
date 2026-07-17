import { createClient } from "@libsql/client";

let client = null;

function getTursoClient() {
  if (client) return client;

  const url = process.env.TURSO_URL || process.env.NEXT_PUBLIC_TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.NEXT_PUBLIC_TURSO_PUBLISHABLE_KEY;
  if (!url) {
    throw new Error("Missing TURSO_URL environment variable.");
  }

  client = createClient({ url, authToken });
  return client;
}

export const turso = new Proxy({}, {
  get(_target, property) {
    return (...args) => getTursoClient()[property](...args);
  },
});
