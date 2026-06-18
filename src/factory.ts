import { z } from "zod";
import { COMPONENTS, COMPONENT_TYPES } from "./components.js";
import { esc, extractImageSlots, type ImageSlot } from "./html.js";

/* ------------------------------ page config ------------------------------- */

/**
 * The shape the AI must return. A page is metadata + an ordered list of
 * sections, where each section is { type, props }. `props` is validated
 * per-component by the factory.
 */
export const pageConfigSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  theme: z
    .object({
      accent: z.string().default("#2563eb"),
      font: z
        .enum(["system", "serif", "mono"])
        .default("system"),
    })
    .default({ accent: "#2563eb", font: "system" }),
  sections: z
    .array(
      z.object({
        type: z.enum(COMPONENT_TYPES as [string, ...string[]]),
        props: z.record(z.unknown()),
      })
    )
    .min(1),
  })
  // Cross-section structural rules the per-component schemas can't see:
  // navbar/hero/ctaBanner appear at most once; navbar (if any) is first; and
  // hero (if any) is the first content section, i.e. right after a navbar or at the top.
  .superRefine((cfg, ctx) => {
    const types = cfg.sections.map((s) => s.type);
    for (const once of ["navbar", "hero", "ctaBanner"] as const) {
      if (types.filter((t) => t === once).length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"${once}" may appear at most once`,
          path: ["sections"],
        });
      }
    }
    const navIdx = types.indexOf("navbar");
    if (navIdx > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"navbar" must be the first section`,
        path: ["sections", navIdx, "type"],
      });
    }
    const heroIdx = types.indexOf("hero");
    if (heroIdx >= 0) {
      const maxHeroIdx = types.includes("navbar") ? 1 : 0;
      if (heroIdx > maxHeroIdx) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"hero" must be the first content section (directly after navbar if present)`,
          path: ["sections", heroIdx, "type"],
        });
      }
    }
  });

export type PageConfig = z.infer<typeof pageConfigSchema>;

/* -------------------------------- manifest -------------------------------- */

/** Machine-readable description of every component, derived from the registry. */
export const buildManifest = () => ({
  components: COMPONENT_TYPES.map((type) => {
    const c = COMPONENTS[type]!;
    return {
      type: c.type,
      description: c.description,
      props: c.props,
    };
  }),
  pageConfigShape: {
    title: "string (required) — used as <title> and og:title",
    description: "string (optional) — meta description",
    theme: {
      accent: "string hex color (optional, default #2563eb)",
      font: "'system' | 'serif' | 'mono' (optional, default 'system')",
    },
    sections:
      "array (required) — ordered list of { type, props }. type must be one of the component types above; props must match that component's spec.",
  },
});

/* --------------------------------- factory -------------------------------- */

const fontStack = (font: PageConfig["theme"]["font"]): string => {
  switch (font) {
    case "serif":
      return `Georgia, 'Times New Roman', serif`;
    case "mono":
      return `ui-monospace, 'SF Mono', Menlo, monospace`;
    default:
      return `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  }
};

const stylesheet = (theme: PageConfig["theme"]): string => `
  :root { --accent: ${esc(theme.accent)}; --font: ${fontStack(theme.font)}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: var(--font); color: #1a1a1a; line-height: 1.55; }
  img { max-width: 100%; height: auto; display: block; border-radius: 8px; background: #eef1f6; }
  h1 { font-size: clamp(2rem, 5vw, 3.25rem); margin: 0 0 .5em; }
  h2.section-heading { text-align: center; font-size: 2rem; margin: 0 0 1.5rem; }
  .lead { font-size: 1.2rem; color: #4b5563; }
  section { padding: 4rem 1.5rem; max-width: 1100px; margin: 0 auto; }
  .btn { display: inline-block; padding: .8rem 1.6rem; border-radius: 8px; text-decoration: none; font-weight: 600; margin-right: .75rem; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-secondary { background: transparent; color: var(--accent); border: 2px solid var(--accent); }
  .hero { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; align-items: center; }
  .hero-ctas { margin-top: 1.5rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; }
  .card { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 12px; }
  .card h3 { margin-top: 0; }
  .testimonial { text-align: center; max-width: 720px; }
  .testimonial blockquote { font-size: 1.4rem; font-style: italic; margin: 0 0 1rem; }
  .cta-banner { text-align: center; background: var(--accent); color: #fff; border-radius: 16px; }
  .cta-banner h2 { margin-top: 0; }
  .cta-banner .btn-primary { background: #fff; color: var(--accent); }

  /* navbar */
  .navbar { display: flex; align-items: center; gap: 2rem; max-width: 1100px; margin: 0 auto; padding: 1rem 1.5rem; }
  .navbar-brand { font-weight: 700; font-size: 1.25rem; color: var(--accent); text-decoration: none; }
  .navbar-links { display: flex; gap: 1.5rem; list-style: none; margin: 0; padding: 0; }
  .navbar-links a { text-decoration: none; color: inherit; }
  .navbar .btn { margin-left: auto; margin-right: 0; }

  /* logoStrip */
  .logo-strip { text-align: center; }
  .logo-strip-heading { margin: 0 0 1.5rem; font-size: .875rem; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; }
  .logo-strip-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 2.5rem; }
  .logo-strip-item { display: inline-flex; align-items: center; }
  .logo-strip-item .logo { height: 48px; width: auto; opacity: .65; filter: grayscale(1); transition: opacity .2s ease, filter .2s ease; }
  .logo-strip-item .logo:hover { opacity: 1; filter: grayscale(0); }

  /* stats */
  .stats-row { display: flex; flex-wrap: wrap; gap: 2rem; justify-content: center; }
  .stat { flex: 1 1 8rem; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .stat-value { font-size: 2.75rem; font-weight: 700; line-height: 1.1; color: var(--accent); }
  .stat-label { margin-top: .5rem; font-size: .95rem; color: #4b5563; }

  /* featureGrid icon */
  .feature-icon { display: block; width: 64px; height: 64px; margin-bottom: .75rem; }

  /* pricingTable */
  .pricing-tier { display: flex; flex-direction: column; }
  .pricing-tier--highlighted { border: 2px solid var(--accent); box-shadow: 0 8px 30px rgba(0,0,0,.08); }
  .pricing-price { font-size: 2.5rem; font-weight: 700; margin: .5rem 0 1rem; }
  .pricing-period { font-size: 1rem; font-weight: 400; color: #6b7280; }
  .pricing-features { list-style: none; padding: 0; margin: 0 0 1.5rem; flex: 1; }
  .pricing-features li { padding: .4rem 0; border-bottom: 1px solid #f1f3f7; }
  .pricing-tier .btn { margin-top: auto; margin-right: 0; text-align: center; }

  /* faq */
  .faq-list { display: flex; flex-direction: column; gap: .75rem; max-width: 760px; margin: 0 auto; }
  .faq-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.25rem; }
  .faq-item summary { cursor: pointer; font-weight: 600; list-style: none; }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-item summary::after { content: "+"; float: right; color: var(--accent); }
  .faq-item[open] summary::after { content: "\\2212"; }
  .faq-item p { margin: .75rem 0 0; color: #4b5563; }

  /* gallery */
  .gallery-item { margin: 0; }
  .gallery-img { width: 100%; height: auto; display: block; border-radius: 8px; }
  .gallery-item figcaption { margin-top: .5rem; font-size: .9rem; color: #4b5563; }

  /* richText prose */
  .prose { max-width: 48rem; }
  .prose p { margin: 0 0 1rem; line-height: 1.7; }

  /* contactForm */
  .contact-form { display: flex; flex-direction: column; gap: 1rem; max-width: 32rem; }
  .form-field { display: flex; flex-direction: column; gap: .35rem; }
  .form-field label { font-weight: 600; }
  .form-field input, .form-field textarea { padding: .6rem .75rem; border: 1px solid #ccc; border-radius: 6px; font: inherit; }
  .form-field textarea { min-height: 8rem; resize: vertical; }

  @media (max-width: 720px) {
    .hero { grid-template-columns: 1fr; }
    .navbar { flex-wrap: wrap; gap: 1rem; }
    .navbar .btn { margin-left: 0; }
  }
`;

export interface RenderResult {
  html: string;
  /** One slot per image placeholder emitted, in document order; url starts null. */
  images: ImageSlot[];
  warnings: string[];
}

/**
 * Handed back verbatim with every render so the agent keeps its hands off the
 * HTML. RATIONALE: in production the agent only ever rewrote the rendered HTML
 * because swapping image placeholders used to require editing the string. We
 * removed that reason — images are surfaced as structured `ImageSlot`s and
 * swapped by the deterministic `apply_images` tool — so there is no longer any
 * cause for the model to touch the html.
 */
export const RENDER_INSTRUCTIONS =
  "Return the html field to the user EXACTLY as provided. Do NOT edit, reformat, re-indent, summarize, or regenerate any part of it. The ONLY change permitted to the page is replacing image placeholders, and you do that by filling the url field of each item in images and calling apply_images — never by editing the html string yourself.";

/**
 * Convert a validated PageConfig into a complete HTML document. Each section's
 * props are validated against its component schema here; an invalid section is
 * skipped and recorded as a warning rather than failing the whole page. Every
 * image placeholder emitted is also collected into `images` for apply_images.
 */
export const renderPage = (config: PageConfig): RenderResult => {
  const warnings: string[] = [];

  const body = config.sections
    .map((section, i) => {
      const comp = COMPONENTS[section.type];
      if (!comp) {
        warnings.push(`section[${i}]: unknown component type "${section.type}" (skipped)`);
        return "";
      }
      const parsed = comp.schema.safeParse(section.props);
      if (!parsed.success) {
        warnings.push(
          `section[${i}] (${section.type}): invalid props — ${parsed.error.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .join("; ")} (skipped)`
        );
        return "";
      }
      return comp.render(parsed.data);
    })
    .filter(Boolean)
    .join("\n\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.title)}</title>
${config.description ? `<meta name="description" content="${esc(config.description)}">` : ""}
<meta property="og:title" content="${esc(config.title)}">
<style>${stylesheet(config.theme)}</style>
</head>
<body>
${body}
</body>
</html>`;

  // Collect from the body only — placeholders only ever appear inside sections.
  const images = extractImageSlots(body);

  return { html, images, warnings };
};
