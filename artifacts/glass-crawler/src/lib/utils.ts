import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(priceStr: string | null | undefined): string {
  if (!priceStr) return "Price not listed";
  // Clean up excessive whitespace often found in scraped prices
  return priceStr.replace(/\s+/g, ' ').trim();
}
