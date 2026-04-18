"use client";

import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "warning";
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  variant = "default",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
          variant === "warning" ? "bg-amber-500/10" : "bg-muted"
        }`}
      >
        {variant === "warning" ? (
          <AlertCircle className="w-6 h-6 text-amber-400" />
        ) : (
          <Icon className="w-6 h-6 text-muted-foreground" />
        )}
      </div>
      <h3 className="font-medium text-sm mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button
          variant={variant === "warning" ? "outline" : "default"}
          size="sm"
          onClick={onAction}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
