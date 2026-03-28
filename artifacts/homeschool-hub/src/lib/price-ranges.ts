import type { LinkPriceRange } from "@workspace/api-client-react";

export const PRICE_RANGE_OPTIONS: { value: LinkPriceRange; label: string; badge: string; color: string }[] = [
  { value: "free",       label: "Free",        badge: "Free",    color: "bg-green-100 text-green-800 border-green-200" },
  { value: "under_10",   label: "Under $10",   badge: "< $10",   color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "under_50",   label: "Under $50",   badge: "< $50",   color: "bg-sky-100 text-sky-800 border-sky-200" },
  { value: "under_100",  label: "Under $100",  badge: "< $100",  color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "under_500",  label: "Under $500",  badge: "< $500",  color: "bg-violet-100 text-violet-800 border-violet-200" },
  { value: "over_500",   label: "$500+",       badge: "$500+",   color: "bg-rose-100 text-rose-800 border-rose-200" },
];

export function getPriceRangeOption(value: LinkPriceRange | null | undefined) {
  if (!value) return null;
  return PRICE_RANGE_OPTIONS.find(o => o.value === value) ?? null;
}
