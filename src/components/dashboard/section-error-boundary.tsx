"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  sectionName: string;
  /**
   * External error key — when this changes, the children will remount.
   * Use this to force a remount when the underlying data/props change,
   * ensuring a retry with new data doesn't get stuck on stale state.
   *
   * If omitted, an internal counter is used that increments on every retry click.
   */
  errorKey?: string;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** Internal retry counter, used as the React key when no external errorKey is provided */
  retryCount: number;
}

export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<SectionErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[SectionErrorBoundary] ${this.props.sectionName}:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      // Increment counter so the React key changes, forcing children to remount.
      // This prevents infinite error loops when the error is caused by bad data
      // that would re-trigger the same crash on a simple setState reset.
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="bg-card/50 border-destructive/30" role="alert">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Something went wrong</h3>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">
              The {this.props.sectionName} section encountered an error. This has been logged. Try again or refresh the page.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
              >
                <RefreshCw className="w-3 h-3 mr-1.5" />
                Retry
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Use external errorKey if provided, otherwise fall back to internal retry counter.
    // Wrapping children in a keyed div ensures React fully unmounts and remounts
    // them when the key changes, resetting all component state and preventing
    // infinite error loops from stale/corrupt state.
    const remountKey = this.props.errorKey ?? String(this.state.retryCount);

    return <div key={remountKey}>{this.props.children}</div>;
  }
}
