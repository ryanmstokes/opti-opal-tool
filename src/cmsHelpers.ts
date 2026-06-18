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

/* ----------------------------- gotcha guards ----------------------------- */

/**
 * Gotcha #2: Properties (and every nested block) must be a real JSON object,
 * never a stringified one. Throws if any nested string is itself JSON for an
 * object/array. Pass `skipKeys` to allow the ONE intentional exception — the
 * experience `composition`, which IS a serialized string (gotcha #3).
 */
export const assertNoStringifiedObjects = (
  value: unknown,
  path = "$",
  skipKeys: string[] = []
): void => {
  if (typeof value === "string") {
    const t = value.trim();
    const looksJson =
      (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
    if (looksJson) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(t);
      } catch {
        parsed = undefined;
      }
      if (parsed && typeof parsed === "object") {
        throw new Error(
          `Stringified object/array at ${path}: pass a real JSON object/array, not a JSON string.`
        );
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoStringifiedObjects(v, `${path}[${i}]`, skipKeys));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (skipKeys.includes(k)) continue;
      assertNoStringifiedObjects(v, `${path}.${k}`, skipKeys);
    }
  }
};

/** Gotcha #3: composition must be a serialized JSON STRING at emit time. */
export const assertCompositionIsString = (composition: unknown): void => {
  if (typeof composition !== "string") {
    throw new Error(
      "composition must be a serialized JSON string at emit time, not an object."
    );
  }
};

/**
 * Gotcha #8: media references use cms://content/{guid}, NEVER cms://content/dam/
 * (which the CMS silently ignores). Throws if any nested string uses the dam form.
 */
export const assertNoDamRefs = (value: unknown, path = "$"): void => {
  if (typeof value === "string") {
    if (value.includes("cms://content/dam/")) {
      throw new Error(
        `Media reference uses the silently-ignored cms://content/dam/ form at ${path}; use cms://content/{guid}.`
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoDamRefs(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertNoDamRefs(v, `${path}.${k}`);
  }
};

/**
 * Gotcha #6: composition nodes must NOT carry an `id` — the CMS auto-generates
 * them. Throws if any object inside the node tree has an `id` key.
 */
export const assertNoNodeIds = (value: unknown, path = "$"): void => {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoNodeIds(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "id")) {
      throw new Error(`Composition node carries an "id" at ${path}; CMS auto-generates ids — omit it.`);
    }
    for (const [k, v] of Object.entries(value)) assertNoNodeIds(v, `${path}.${k}`);
  }
};
