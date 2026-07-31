/** Tiny classnames joiner — drops falsy values. Avoids a dependency. */
export function clsx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
