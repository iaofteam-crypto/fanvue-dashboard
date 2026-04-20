"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Root layout error boundary — catches errors in layout.tsx providers.
 *
 * This renders its own <html> and <body> because the root layout is broken,
 * so we must provide the full document structure.
 *
 * Triggers when: ThemeProvider, QueryProvider, or other root-level components crash.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError] Root layout error:", error);
  }, [error]);

  const sanitizedMsg = (error.message ?? "Unknown error").split("\n")[0].slice(0, 200);

  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Application Error</h1>
          <p className="text-muted-foreground mb-2 max-w-md">
            The application encountered a critical error and could not load.
            This has been logged for investigation.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground mb-4 font-mono">
              Error ID: {error.digest}
            </p>
          )}
          <div className="rounded-md bg-muted/50 border p-3 mb-6 max-w-md w-full">
            <p className="text-xs font-mono text-muted-foreground break-all">
              {sanitizedMsg}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={reset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
