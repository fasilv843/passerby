/** Tailwind classes for a video grid holding `count` tiles. Literal strings so Tailwind keeps them. */
export function gridColumnsClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-2 lg:grid-cols-3";
}
