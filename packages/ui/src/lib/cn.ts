/**
 * cn — class name utility.
 * Merges Tailwind classes intelligently using clsx + tailwind-merge.
 * Components use this to combine base classes with consumer overrides.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
