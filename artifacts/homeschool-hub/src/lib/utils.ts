import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize a user-supplied URL so it can be used in an href attribute.
 * Only http:// and https:// URLs are passed through. Everything else
 * (javascript:, data:, vbscript:, relative paths, etc.) returns "#".
 */
export function safeUrl(url: string | null | undefined): string {
  if (!url) return "#";
  try {
    const u = new URL(url.trim());
    if (u.protocol === "http:" || u.protocol === "https:") return url.trim();
  } catch {
    // Not a valid absolute URL
  }
  return "#";
}
