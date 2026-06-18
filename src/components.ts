import { z } from "zod";
import { esc, placeholderImg } from "./html.js";

/**
 * A Component is the single source of truth for one building block:
 *   - `schema`   validates the props the AI provides
 *   - `manifest` is the human/AI-readable description of those props
 *   - `render`   turns validated props into an HTML fragment
 *
 * Because the manifest and the renderer live in the same object, they cannot
 * drift apart. The factory and the AI prompt both derive from this registry.
 */
export interface PropSpec {
  name: string;
  type: "string" | "string[]" | "boolean" | "ctaList" | "featureList";
  required: boolean;
  description: string;
}

export interface Component<TProps> {
  type: string;
  description: string;
  props: PropSpec[];
  schema: z.ZodType<TProps>;
  render: (props: TProps) => string;
}

const def = <TProps>(c: Component<TProps>): Component<TProps> => c;

/* ----------------------------- shared shapes ----------------------------- */

const ctaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  style: z.enum(["primary", "secondary"]).default("primary"),
});

/* ------------------------------- hero ------------------------------------ */

const hero = def({
  type: "hero",
  description:
    "Top-of-page hero banner with a headline, supporting subheadline, an optional image, and call-to-action buttons. Use exactly once, as the first section.",
  props: [
    { name: "headline", type: "string", required: true, description: "Main H1 headline. Short and punchy." },
    { name: "subheadline", type: "string", required: false, description: "One or two supporting sentences below the headline." },
    { name: "imageAlt", type: "string", required: false, description: "Description of the hero image. A placeholder is generated from this; do not provide a URL." },
    { name: "ctas", type: "ctaList", required: false, description: "Up to 2 call-to-action buttons. First should be style 'primary'." },
  ],
  schema: z.object({
    headline: z.string().min(1),
    subheadline: z.string().optional(),
    imageAlt: z.string().optional(),
    ctas: z.array(ctaSchema).max(2).optional(),
  }),
  render: (p) => {
    const ctas = (p.ctas ?? [])
      .map(
        (c) =>
          `<a class="btn btn-${esc(c.style)}" href="${esc(c.href)}">${esc(c.label)}</a>`
      )
      .join("\n        ");
    const img = p.imageAlt ? placeholderImg(p.imageAlt, 1200, 600, "hero-img") : "";
    return `<section class="hero">
      <div class="hero-text">
        <h1>${esc(p.headline)}</h1>
        ${p.subheadline ? `<p class="lead">${esc(p.subheadline)}</p>` : ""}
        ${ctas ? `<div class="hero-ctas">\n        ${ctas}\n        </div>` : ""}
      </div>
      ${img ? `<div class="hero-media">${img}</div>` : ""}
    </section>`;
  },
});

/* ----------------------------- featureGrid -------------------------------- */

const featureGrid = def({
  type: "featureGrid",
  description:
    "A grid of 2-4 feature cards, each with a title and short body. Use to highlight product benefits or selling points.",
  props: [
    { name: "heading", type: "string", required: false, description: "Optional section heading above the grid." },
    {
      name: "features",
      type: "featureList",
      required: true,
      description: "Array of 2-4 items, each { title: string, body: string }.",
    },
  ],
  schema: z.object({
    heading: z.string().optional(),
    features: z
      .array(z.object({ title: z.string().min(1), body: z.string().min(1) }))
      .min(2)
      .max(4),
  }),
  render: (p) => {
    const cards = p.features
      .map(
        (f) =>
          `<div class="card"><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p></div>`
      )
      .join("\n        ");
    return `<section class="features">
      ${p.heading ? `<h2 class="section-heading">${esc(p.heading)}</h2>` : ""}
      <div class="grid">
        ${cards}
      </div>
    </section>`;
  },
});

/* ------------------------------ testimonial ------------------------------- */

const testimonial = def({
  type: "testimonial",
  description:
    "A single customer quote with attribution. Use to add social proof.",
  props: [
    { name: "quote", type: "string", required: true, description: "The testimonial text, without surrounding quote marks." },
    { name: "author", type: "string", required: true, description: "Name of the person." },
    { name: "role", type: "string", required: false, description: "Their title / company." },
  ],
  schema: z.object({
    quote: z.string().min(1),
    author: z.string().min(1),
    role: z.string().optional(),
  }),
  render: (p) =>
    `<section class="testimonial">
      <blockquote>&ldquo;${esc(p.quote)}&rdquo;</blockquote>
      <p class="attribution"><strong>${esc(p.author)}</strong>${
        p.role ? ` &middot; ${esc(p.role)}` : ""
      }</p>
    </section>`,
});

/* --------------------------------- ctaBanner ------------------------------ */

const ctaBanner = def({
  type: "ctaBanner",
  description:
    "A full-width closing call-to-action band with a heading and one button. Use once, near the bottom.",
  props: [
    { name: "heading", type: "string", required: true, description: "The closing prompt, e.g. 'Ready to get started?'" },
    { name: "cta", type: "ctaList", required: true, description: "A single CTA: { label, href, style }." },
  ],
  schema: z.object({
    heading: z.string().min(1),
    cta: ctaSchema,
  }),
  render: (p) =>
    `<section class="cta-banner">
      <h2>${esc(p.heading)}</h2>
      <a class="btn btn-${esc(p.cta.style)}" href="${esc(p.cta.href)}">${esc(p.cta.label)}</a>
    </section>`,
});

/* ------------------------------- registry --------------------------------- */

/** All components, keyed by type. Add a component here and everything updates. */
export const COMPONENTS: Record<string, Component<any>> = {
  hero,
  featureGrid,
  testimonial,
  ctaBanner,
};

export const COMPONENT_TYPES = Object.keys(COMPONENTS);
