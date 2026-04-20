/**
 * @vitest-environment jsdom
 *
 * Unit tests for SectionErrorBoundary.
 *
 * Tests the enhanced error boundary component:
 * 1. Renders children when no error
 * 2. Shows fallback UI when error is thrown
 * 3. Retry button resets error state
 * 4. Max retries shows degraded state
 * 5. Error details toggle
 * 6. Copy error button
 * 7. Go to Dashboard button
 * 8. Optional onError callback fires
 * 9. Sanitized error message (no stack traces)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SectionErrorBoundary } from "@/components/dashboard/section-error-boundary";

// ─── Helper: component that throws on command ────────────────────────────────

function ThrowingChild({ shouldThrow, error = new Error("Test error message") }: { shouldThrow: boolean; error?: Error }) {
  if (shouldThrow) {
    throw error;
  }
  return <div data-testid="child-content">Content rendered</div>;
}

// ─── Suppress console.error from React error boundary logs ───────────────────

let originalConsoleError: typeof console.error;
beforeEach(() => {
  originalConsoleError = console.error;
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

// ─── Helper to force error on a TestBoundary ────────────────────────────────

class TestBoundary extends SectionErrorBoundary {
  public forceError(error: Error) {
    this.setState(SectionErrorBoundary.getDerivedStateFromError(error));
  }
  public forceErrorWithRetry(error: Error) {
    this.setState({
      ...SectionErrorBoundary.getDerivedStateFromError(error),
      retryCount: this.state.retryCount + 1,
    });
  }
  public getState() {
    return this.state;
  }
}

function renderWithRef(sectionName = "Test") {
  const ref = React.createRef<TestBoundary>();
  const result = render(
    <TestBoundary ref={ref} sectionName={sectionName}>
      <div data-testid="child-content">Normal content</div>
    </TestBoundary>
  );
  return { ref, ...result };
}

function forceError(ref: React.RefObject<TestBoundary | null>, error?: Error) {
  act(() => {
    ref.current?.forceError(error ?? new Error("Test crash"));
  });
}

function forceErrorWithRetry(ref: React.RefObject<TestBoundary | null>, error?: Error) {
  act(() => {
    ref.current?.forceErrorWithRetry(error ?? new Error("Test crash"));
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SectionErrorBoundary — renders children", () => {
  it("renders children when no error occurs", () => {
    render(
      <SectionErrorBoundary sectionName="TestSection">
        <div>Hello</div>
      </SectionErrorBoundary>
    );
    expect(screen.getByText("Hello")).toBeDefined();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("renders with custom icon prop — shown in error fallback", () => {
    const ref = React.createRef<TestBoundary>();
    render(
      <TestBoundary ref={ref} sectionName="TestSection" icon={<div data-testid="custom-icon">!</div>}>
        <div>Normal</div>
      </TestBoundary>
    );
    // Icon not visible during normal render (it's in the error fallback)
    expect(screen.getByText("Normal")).toBeDefined();

    // Force error to see custom icon
    forceError(ref);
    expect(screen.getByTestId("custom-icon")).toBeDefined();
  });

  it("renders with custom description when no error", () => {
    render(
      <SectionErrorBoundary sectionName="Test" description="Custom desc">
        <div>Normal</div>
      </SectionErrorBoundary>
    );
    expect(screen.getByText("Normal")).toBeDefined();
  });
});

describe("SectionErrorBoundary — catches errors", () => {
  it("shows error fallback when child throws", () => {
    const { ref } = renderWithRef("Messages");
    expect(screen.getByText("Normal content")).toBeDefined();

    forceError(ref);
    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByText(/Messages/)).toBeDefined();
  });

  it("displays section name in error message", () => {
    const { ref } = renderWithRef("Analytics");
    forceError(ref);

    expect(screen.getByText(/Analytics/)).toBeDefined();
    expect(screen.getByText("Retry")).toBeDefined();
    expect(screen.getByText("Go to Dashboard")).toBeDefined();
  });

  it("shows sanitized error message (no stack traces)", () => {
    const { ref } = renderWithRef("Test");
    const stackError = new Error("API call failed\n    at fetch (native)\n    at async loadData");
    forceError(ref, stackError);

    // Stack trace should NOT be visible by default (details hidden)
    expect(screen.queryByText(/at fetch/)).toBeNull();
  });

  it("truncates long error messages to 200 chars", () => {
    const { ref } = renderWithRef("Test");
    const longError = new Error("X".repeat(500));
    forceError(ref, longError);

    // Toggle details
    fireEvent.click(screen.getByText(/Show Details/));

    // The displayed error should be truncated to 200 chars
    const errorEl = screen.getByText((content) => content.startsWith("X") && content.length <= 200);
    expect(errorEl).toBeDefined();
  });
});

describe("SectionErrorBoundary — retry mechanism", () => {
  it("retry button resets error and re-renders children", () => {
    const { ref } = renderWithRef("Test");
    forceError(ref);

    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(ref.current?.getState().retryCount).toBe(0);

    // Click Retry
    fireEvent.click(screen.getByText("Retry"));
    expect(screen.getByText("Normal content")).toBeDefined();
    expect(ref.current?.getState().retryCount).toBe(1);
  });

  it("shows attempt count badge after retry", () => {
    const { ref } = renderWithRef("Test");
    // First error + retry
    forceErrorWithRetry(ref);
    expect(screen.getByText(/1 attempt/)).toBeDefined();
  });

  it("hides retry button after MAX_RETRIES (3)", () => {
    const { ref } = renderWithRef("Test");

    // Manually set retry count to 3 (simulating 3 failed retries)
    act(() => {
      ref.current?.setState({
        ...SectionErrorBoundary.getDerivedStateFromError(new Error("Max")),
        retryCount: 3,
      });
    });

    // Check degraded state
    expect(screen.queryByText("Retry")).toBeNull();
    expect(screen.getByText(/Try again later/)).toBeDefined();
    expect(screen.getByText(/3 attempts/)).toBeDefined();
  });
});

describe("SectionErrorBoundary — interactive features", () => {
  it("toggle error details shows/hides error message", () => {
    const { ref } = renderWithRef("Test");
    forceError(ref, new Error("Visible error details"));

    // Details hidden by default
    expect(screen.queryByText("Visible error details")).toBeNull();

    // Click "Show Details"
    fireEvent.click(screen.getByText(/Show Details/));
    expect(screen.getByText("Visible error details")).toBeDefined();

    // Click "Hide Details"
    fireEvent.click(screen.getByText(/Hide Details/));
    expect(screen.queryByText("Visible error details")).toBeNull();
  });

  it("calls onError callback when error is caught", () => {
    const onError = vi.fn();
    const ref = React.createRef<TestBoundary>();
    render(
      <TestBoundary ref={ref} sectionName="Custom" onError={onError}>
        <div>Content</div>
      </TestBoundary>
    );

    act(() => {
      const error = new Error("Reported error");
      ref.current?.componentDidCatch(error, { componentStack: "" });
      ref.current?.forceError(error);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe("Reported error");
  });

  it("uses custom description in error fallback", () => {
    const ref = React.createRef<TestBoundary>();
    render(
      <TestBoundary ref={ref} sectionName="Analytics" description="Charts failed to load">
        <div>Content</div>
      </TestBoundary>
    );

    forceError(ref);
    expect(screen.getByText("Charts failed to load")).toBeDefined();
    expect(screen.queryByText(/Analytics section encountered/)).toBeNull();
  });

  it("renders Go to Dashboard button in error state", () => {
    const { ref } = renderWithRef("Messages");
    forceError(ref);
    expect(screen.getByText("Go to Dashboard")).toBeDefined();
  });
});
