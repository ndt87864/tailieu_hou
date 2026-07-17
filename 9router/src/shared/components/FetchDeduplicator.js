"use client";

import { useEffect } from "react";

const activeFetches = new Map();

export default function FetchDeduplicator() {
  useEffect(() => {
    if (typeof window === "undefined" || window.__fetch_deduped__) return;
    window.__fetch_deduped__ = true;

    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : input?.url;
      const isGet = !init || !init.method || init.method.toUpperCase() === "GET";
      const isApi = url && (url.startsWith("/api/") || url.includes("/api/"));

      if (isGet && isApi) {
        const key = url;
        if (activeFetches.has(key)) {
          return activeFetches.get(key).then((res) => res.clone());
        }

        const promise = originalFetch.apply(this, arguments)
          .then(async (response) => {
            const text = await response.text();
            
            const createResponse = () => new Response(text, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });

            setTimeout(() => {
              activeFetches.delete(key);
            }, 1000);

            return createResponse();
          })
          .catch((err) => {
            activeFetches.delete(key);
            throw err;
          });

        activeFetches.set(key, promise);
        return promise.then((res) => res.clone());
      }

      return originalFetch.apply(this, arguments);
    };
  }, []);

  return null;
}
