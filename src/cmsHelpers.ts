import { esc } from "./html.js";

/**
 * Pure helpers for building Optimizely SaaS CMS payloads. They exist to make the
 * silent-failure gotchas (see section 4 of the brief) impossible to get wrong:
 *   - links are real Link OBJECTS, never strings
 *   - contentReferences are bare STRINGS "cms://content/{guid}" (no hyphens), never objects
 *   - richText is an HTML string, never a stringified object
 *
 * The gotcha-ASSERTION guards (assertNoStringifiedObjects, assertComposition…)
 * are added in Phase 4; this file holds the value constructors used by mapProps.
 */

/** A CMS Link property value: a relative/absolute url plus its display text. */
export interface CmsLink {
  url: string;
  title: string;
}

/** Build a Link OBJECT (gotcha: links are objects, not strings). */
export const link = (label: string, href: string): CmsLink => ({
  url: href,
  title: label,
});

/**
 * Build a contentReference value. ALWAYS a bare string "cms://content/{guid}"
 * with NO hyphens in the guid (gotcha #1), and NEVER the cms://content/dam/…
 * form (gotcha #8). Callers add ?loc=/&ver= if they need them.
 */
export const contentRef = (guid: string): string =>
  `cms://content/${guid.replace(/-/g, "")}`;

/**
 * Convert plain (optionally multi-paragraph) prose into safe richText HTML.
 * Each blank-line-separated block becomes an escaped <p>, so arbitrary author
 * text can never inject markup.
 */
export const richTextHtml = (text: string): string =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");
