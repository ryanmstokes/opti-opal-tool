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

/** Reverse of `esc` — decode exactly the five entities `esc` produces. */
export const unesc = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/**
 * One image the page still needs. The factory emits one slot per `<img>`
 * placeholder it renders; the agent fills `url`, and `applyImages` swaps it in.
 * Keeping images as structured data (rather than something to find in the HTML)
 * is what lets the agent leave the rendered html untouched.
 */
export interface ImageSlot {
  /** The exact "{{IMAGE:WxH:slug}}" token as it appears in the html. */
  placeholder: string;
  /** Designer-facing description of the wanted image. */
  alt: string;
  width: number;
  height: number;
  /** Real asset URL once sourced; null until then. */
  url: string | null;
}

/**
 * Scan rendered HTML for placeholder `<img>` tags and return one ImageSlot per
 * tag, in document order. The placeholder token is authoritative for the
 * dimensions; `alt` is read back from the tag and un-escaped.
 */
export const extractImageSlots = (html: string): ImageSlot[] => {
  const slots: ImageSlot[] = [];
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const src = /\bsrc="([^"]*)"/i.exec(tag)?.[1] ?? "";
    const m = /^\{\{IMAGE:(\d+)x(\d+):[^}]+\}\}$/.exec(src);
    if (!m) continue;
    slots.push({
      placeholder: src,
      alt: unesc(/\balt="([^"]*)"/i.exec(tag)?.[1] ?? ""),
      width: Number(m[1]),
      height: Number(m[2]),
      url: null,
    });
  }
  return slots;
};

/**
 * Deterministically swap each resolved placeholder for its url. Slots map 1:1 to
 * the `<img>` tags in document order (that is the order `extractImageSlots`
 * produced them), so we consume placeholders POSITIONALLY: each slot replaces the
 * next occurrence of its token at or after a moving cursor. This is a literal
 * substring substitution (the url is never interpreted as a regex) and — unlike a
 * global replace — it handles duplicate tokens correctly: two images that share an
 * identical token (same alt + same dimensions) each get their own distinct url
 * instead of the first url clobbering both. Slots whose url is still null are kept
 * in place and reported. This is the ONLY sanctioned way to put real images into a
 * page — the agent must never hand-edit the html.
 */
export const applyImages = (
  html: string,
  images: ReadonlyArray<{ placeholder: string; url: string | null; alt?: string }>
): { html: string; warnings: string[] } => {
  const warnings: string[] = [];
  let out = "";
  let cursor = 0;
  for (const slot of images) {
    const idx = html.indexOf(slot.placeholder, cursor);
    if (idx === -1) {
      warnings.push(
        `Image placeholder "${slot.placeholder}" not found in html at/after the expected position (already replaced, missing, or images out of order).`
      );
      continue;
    }
    out += html.slice(cursor, idx);
    if (slot.url == null || slot.url === "") {
      out += slot.placeholder; // keep the unresolved placeholder in place
      warnings.push(
        `Image placeholder "${slot.placeholder}" left unresolved (no url) — kept in place.${
          slot.alt ? ` Alt: "${slot.alt}".` : ""
        }`
      );
    } else {
      out += slot.url; // literal substitution; url is not interpreted
    }
    cursor = idx + slot.placeholder.length;
  }
  out += html.slice(cursor);
  return { html: out, warnings };
};
