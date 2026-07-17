"use client";

/**
 * Global Error Boundary
 * This file overrides Next.js's internal /_global-error page.
 * It renders outside the root layout (no ThemeProvider/I18nProvider),
 * so it must be a minimal standalone component with its own <html> and <body>.
 */
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong</title>
        <style>{`
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0a0a0a;
            color: #e5e5e5;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .container {
            text-align: center;
            padding: 2rem;
            max-width: 480px;
          }
          h2 { font-size: 1.5rem; margin-bottom: 0.75rem; }
          p { color: #888; margin-bottom: 1.5rem; font-size: 0.95rem; }
          button {
            padding: 0.6rem 1.4rem;
            background: #6366f1;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.95rem;
          }
          button:hover { background: #5254cc; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <h2>Something went wrong</h2>
          <p>{error?.message || "An unexpected error occurred. Please try again."}</p>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
