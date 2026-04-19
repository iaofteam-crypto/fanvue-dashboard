"use client";

import React from "react";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface SectionBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const SectionBreadcrumbs = React.memo(function SectionBreadcrumbs({ items }: SectionBreadcrumbsProps) {
  if (items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label + index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
              )}
              {isLast ? (
                <span aria-current="page" className="font-medium text-foreground">{item.label}</span>
              ) : item.onClick ? (
                <button
                  onClick={item.onClick}
                  className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
                >
                  {item.label}
                </button>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});
