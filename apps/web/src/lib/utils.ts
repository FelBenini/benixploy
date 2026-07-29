import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type WithElementRef<T, Base = HTMLElement> = T & {
  ref?: Base | null;
  [key: string]: unknown;
};

export type WithoutChildrenOrChild<T> = Omit<T, "children" | "child">;
export type WithoutChildren<T> = Omit<T, "children">;
