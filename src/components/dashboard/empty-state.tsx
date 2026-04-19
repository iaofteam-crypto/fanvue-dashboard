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
  /** Optional secondary action (e.g. "Learn more") */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: "default" | "warning" | "info" | "success";
  /** Size: compact for inline (dialogs, sub-panels), full for main sections */
  size?: "compact" | "full";
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = "default",
  size = "full",
}: EmptyStateProps) {
  const iconColors = {
    default: "bg-muted text-muted-foreground",
    warning: "bg-amber-500/10 text-amber-400",
    info: "bg-sky-500/10 text-sky-400",
    success: "bg-emerald-500/10 text-emerald-400",
  };

  const isCompact = size === "compact";

  return (
    <div role="status" aria-label={title} className={`flex flex-col items-center justify-center text-center px-4 ${isCompact ? "py-6" : "py-16"}`}>
      {/* Icon */}
      <div
        className={`rounded-full flex items-center justify-center mb-4 ${
          isCompact ? "w-10 h-10" : "w-16 h-16"
        } ${iconColors[variant]}`}
        aria-hidden="true"
      >
        {variant === "warning" ? (
          <AlertCircle className={isCompact ? "w-5 h-5" : "w-7 h-7 text-amber-400"} />
        ) : (
          <Icon className={`${isCompact ? "w-5 h-5" : "w-7 h-7"}`} />
        )}
      </div>

      {/* Title */}
      <h3 className={`font-semibold mb-1 ${isCompact ? "text-sm" : "text-base"}`}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className={`text-muted-foreground max-w-sm mb-4 ${isCompact ? "text-xs" : "text-sm"}`}>
          {description}
        </p>
      )}

      {/* Actions */}
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-2 mt-1">
          {actionLabel && onAction && (
            <Button
              variant={variant === "warning" ? "outline" : "default"}
              size={isCompact ? "sm" : "default"}
              onClick={onAction}
              className={variant !== "warning" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
            >
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              variant="ghost"
              size={isCompact ? "sm" : "default"}
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
