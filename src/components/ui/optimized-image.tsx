"use client";

import Image, { type ImageProps } from "next/image";
import { useState, useCallback } from "react";

// Tiny 1x1 transparent PNG as universal blur placeholder
const BLUR_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wNSkiLz48L3N2Zz4=";

interface OptimizedImageProps extends Omit<ImageProps, "onError"> {
  /** Fallback icon shown while loading or on error */
  fallbackIcon?: React.ReactNode;
  /** Container className wrapping the image */
  containerClassName?: string;
  /** Whether this is a blob/data URL preview (skips Next.js optimization) */
  unoptimizedBlob?: boolean;
}

/**
 * OptimizedImage — wraps next/image with:
 * - Automatic blur placeholder while loading
 * - Graceful error fallback (shows fallbackIcon)
 * - Optional unoptimized mode for blob/data URLs
 * - Lazy loading by default (next/image built-in)
 */
export function OptimizedImage({
  src,
  alt,
  fallbackIcon,
  containerClassName,
  unoptimizedBlob = false,
  className,
  fill,
  width,
  height,
  sizes,
  ...props
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  // For blob URLs, use unoptimized mode (Next.js can't optimize blob URLs)
  const isBlobUrl =
    unoptimizedBlob ||
    (typeof src === "string" && src.startsWith("blob:"));

  if (hasError && fallbackIcon) {
    return (
      <div
        className={containerClassName || className}
        style={!containerClassName && !fill ? { width, height } : undefined}
      >
        {fallbackIcon}
      </div>
    );
  }

  return (
    <div
      className={containerClassName}
      style={
        !containerClassName && !fill
          ? { width: width ?? "auto", height: height ?? "auto" }
          : undefined
      }
    >
      {!isLoaded && !fill && (
        <div
          className="absolute inset-0 bg-muted animate-pulse rounded-[inherit]"
          aria-hidden="true"
        />
      )}
      <Image
        src={src}
        alt={alt}
        className={`${className || ""}${!isLoaded ? " opacity-0" : " opacity-100"} transition-opacity duration-300`}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        sizes={sizes}
        placeholder="blur"
        blurDataURL={BLUR_PLACEHOLDER}
        unoptimized={isBlobUrl}
        onLoad={() => setIsLoaded(true)}
        onError={handleError}
        loading="lazy"
        {...props}
      />
    </div>
  );
}

/**
 * AvatarImage — circular avatar with blur placeholder + initial fallback
 */
interface AvatarImageProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: number;
  className?: string;
}

export function AvatarImage({
  src,
  alt = "",
  name,
  size = 40,
  className,
}: AvatarImageProps) {
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  if (!src) {
    return (
      <div
        className={`rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden text-primary/60 font-medium ${className || ""}`}
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`rounded-full overflow-hidden flex-shrink-0 relative ${className || ""}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt || name || ""}
        fill
        sizes={`${size}px`}
        className="object-cover"
        placeholder="blur"
        blurDataURL={BLUR_PLACEHOLDER}
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    </div>
  );
}

/**
 * MediaThumbnail — optimized thumbnail for vault/media grids
 */
interface MediaThumbnailProps {
  src?: string | null;
  alt?: string;
  type?: string;
  className?: string;
  children?: React.ReactNode;
}

export function MediaThumbnail({
  src,
  alt = "",
  className,
  children,
}: MediaThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`relative bg-muted/30 ${className || ""}`}>
      {src && !hasError ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover"
          placeholder="blur"
          blurDataURL={BLUR_PLACEHOLDER}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        </div>
      )}
      {children}
    </div>
  );
}
