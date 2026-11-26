/** Small text helpers used for matching names. Ported from the prototype (clean, ci, norm, lev, similar). */

/** Trim and collapse runs of spaces. Treats null/undefined as "". */
export function clean(s: unknown): string {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

/** Case-insensitive key for exact name matching. */
export function ci(s: unknown): string {
  return clean(s).toLowerCase();
}

/**
 * A looser key for spotting near-duplicates: "PO #", "PO No." and "PO Numbers" all become "po number".
 */
export function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/#/g, " number ")
    .replace(/\bno\.?(?=\s|$)/g, " number ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/s\b/g, "");
}

/** Edit distance between two strings (how many single-letter changes turn one into the other). */
export function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/** True when two different names probably mean the same thing. */
export function similar(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y || ci(a) === ci(b)) return false;
  return x === y || (Math.min(x.length, y.length) >= 5 && lev(x, y) <= 1);
}

/** A file-name-safe version of a title, e.g. "Dave's shop: order" -> "dave-s-shop-order". */
export function slug(title: string): string {
  return (
    String(title || "map")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "map"
  );
}
