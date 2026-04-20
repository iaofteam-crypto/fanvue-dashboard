"use client";

import React from "react";
import { SectionErrorBoundary as Boundary } from "@/components/dashboard/section-error-boundary";

/**
 * HOC that wraps a component in a SectionErrorBoundary.
 *
 * Usage with dynamic imports:
 * ```tsx
 * const MessagesSection = dynamic(
 *   () => import("@/components/dashboard/messages-section").then(m => withErrorBoundary(m.default, "Messages")),
 *   { loading: () => <SectionSkeleton />, ssr: false }
 * );
 * ```
 *
 * Features:
 * - Automatically passes sectionName and captures errors
 * - Props: sectionName, icon, description, onError (forwarded to SectionErrorBoundary)
 * - All other props are passed through to the wrapped component
 */
export function withErrorBoundary<P extends Record<string, unknown>>(
  WrappedComponent: React.ComponentType<P>,
  sectionName: string,
  options?: {
    icon?: React.ReactNode;
    description?: string;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  }
): React.ComponentType<P> {
  function WithErrorBoundaryInner(props: P) {
    return (
      <Boundary
        sectionName={sectionName}
        icon={options?.icon}
        description={options?.description}
        onError={options?.onError}
      >
        <WrappedComponent {...props} />
      </Boundary>
    );
  }

  const name = WrappedComponent.displayName ?? WrappedComponent.name ?? "Component";
  WithErrorBoundaryInner.displayName = `withErrorBoundary(${name})`;

  return WithErrorBoundaryInner;
}
