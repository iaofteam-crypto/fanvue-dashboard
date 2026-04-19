// Shared Framer Motion animation variants for the Fanvue Dashboard
// Used across sections for consistent, performant animations

import type { Variants } from "framer-motion";

// ─── Page Transitions ─────────────────────────────────────────────────────

/** Fade in + slight slide up on section enter, fade out on leave */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] },
  },
};

// ─── Stagger Containers ───────────────────────────────────────────────────

/** Parent container — staggerChildren animates each child with a delay */
export const staggerContainer = (stagger = 0.04): Variants => ({
  animate: {
    transition: {
      staggerChildren: stagger,
    },
  },
});

// ─── Stagger Items ────────────────────────────────────────────────────────

/** Individual item inside a stagger container — fade + slight scale */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
  },
};

// ─── Simple Fade In ───────────────────────────────────────────────────────

/** Simple fade-in for single elements */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
};

// ─── Fade In Up ───────────────────────────────────────────────────────────

/** Fade + slide up for cards and panels */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
};

// ─── Scale In ─────────────────────────────────────────────────────────────

/** Scale from 95% to 100% — useful for modals and dialogs */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
  },
};

// ─── Micro-interaction hover / tap ────────────────────────────────────────

/** While hover — subtle scale up */
export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { type: "spring", stiffness: 400, damping: 25 },
} as const;
