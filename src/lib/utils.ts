import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { z } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type FieldErrors<T extends Record<string, unknown>> = Partial<Record<keyof T, string[]>>;

export function getFieldErrors<T extends Record<string, unknown>>(
  error: z.ZodError<T>
): FieldErrors<T> {
  const tree = z.treeifyError(error);

  if (!("properties" in tree)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(tree.properties ?? {}).map(([field, value]) => [field, value?.errors ?? []])
  ) as FieldErrors<T>;
}
