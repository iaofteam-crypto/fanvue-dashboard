import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient instance with stale-while-revalidate defaults.
 *
 * - staleTime 60s: data considered fresh for 1 minute (avoids redundant refetches
 *   when switching between tabs)
 * - gcTime 5min: cached data kept for 5 min after all subscribers unmount
 *   (instant restore when navigating back)
 * - retry 1: one retry on failure, then show error
 * - refetchOnWindowFocus true: revalidate when user returns to tab
 * - refetchOnReconnect true: revalidate when network reconnects
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Returns a singleton QueryClient for the browser.
 * Server-side always creates a fresh instance to avoid cross-request state leaks.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
