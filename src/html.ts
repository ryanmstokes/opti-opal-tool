/** Escape user/AI-provided strings before interpolating into HTML. */
export const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Image placeholder. The AI never invents real image URLs — it provides an
 * `alt` description and we emit a deterministic placeholder src keyed on the
 * requested dimensions and a slug of the alt text. A downstream step (or a
 * human) swaps these for real assets.
 */
export const placeholderImg = (
  alt: string,
  width: number,
  height: number,
  extraClass = ""
): string => {
  const slug = encodeURIComponent(
    (alt || "image").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40)
  );
  const src = `{{IMAGE:${width}x${height}:${slug}}}`;
  const cls = extraClass ? ` class="${esc(extraClass)}"` : "";
  return `<img src="${src}" alt="${esc(alt)}" width="${width}" height="${height}" loading="lazy"${cls}>`;
};
