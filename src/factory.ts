import { z } from "zod";
import { COMPONENTS, COMPONENT_TYPES } from "./components.js";
import { esc } from "./html.js";

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
  @media (max-width: 720px) { .hero { grid-template-columns: 1fr; } }
`;

export interface RenderResult {
  html: string;
  warnings: string[];
}

/**
 * Convert a validated PageConfig into a complete HTML document. Each section's
 * props are validated against its component schema here; an invalid section is
 * skipped and recorded as a warning rather than failing the whole page.
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

  return { html, warnings };
};
