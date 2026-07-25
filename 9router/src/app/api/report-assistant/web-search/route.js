import { NextResponse } from "next/server";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const authToken = request.cookies.get("auth_token")?.value || null;
    const session = authToken ? await getDashboardAuthSession(authToken) : null;
    const username = session?.username || "admin";

    const { query, url, mode } = await request.json();

    // 1. If a URL is provided, crawl it using Jina Reader
    if (url) {
      const jinaKey = process.env.JINA_API_KEY || "";
      const headers = {};
      if (jinaKey) {
        headers["Authorization"] = `Bearer ${jinaKey}`;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`[Jina Reader] Crawling URL: ${url}`);
      }
      const res = await fetch(`https://r.jina.ai/${url}`, {
        method: "GET",
        headers
      });

      if (!res.ok) {
        throw new Error(`Jina Reader failed with status ${res.status}`);
      }

      const content = await res.text();
      return NextResponse.json({ success: true, type: "jina", content });
    }

    // 2. If a search query is provided, perform search using Tavily AI
    if (query) {
      const tavilyKey = process.env.TAVILY_API_KEY;
      if (!tavilyKey) {
        return NextResponse.json({
          success: false,
          type: "tavily",
          error: "Tavily API key is not configured in .env",
          results: null,
        });
      }

      const cleanQuery = String(query || "").replace(/\s+/g, " ").trim().slice(0, 400);
      if (!cleanQuery) {
        return NextResponse.json({
          success: false,
          type: "tavily",
          error: "Missing search query",
          results: null,
        });
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`[Tavily Search] Query: ${cleanQuery}`);
      }
      const fastMode = mode === "fast";
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tavilyKey}`,
        },
        body: JSON.stringify({
          query: cleanQuery,
          search_depth: fastMode ? "basic" : "advanced",
          include_answer: true,
          max_results: fastMode ? 2 : 5,
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`[Tavily Search] Failed with status ${res.status}: ${errText.slice(0, 300)}`);
        return NextResponse.json({
          success: false,
          type: "tavily",
          error: `Tavily API failed with status ${res.status}`,
          details: errText.slice(0, 500),
          results: null,
        });
      }

      const data = await res.json();
      return NextResponse.json({ success: true, type: "tavily", results: data });
    }

    return NextResponse.json({ error: "Missing query or url parameters" }, { status: 400 });
  } catch (err) {
    console.error("[Web Search API Error]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
