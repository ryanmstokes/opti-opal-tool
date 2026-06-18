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
  type:
    | "string"
    | "string[]"
    | "boolean"
    | "link"
    | "linkList"
    | "ctaList"
    | "objectList";
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

/** Every href/url must be relative ("/signup") or absolute ("https://…"). */
const hrefSchema = z
  .string()
  .regex(/^(\/|https?:\/\/)/, "href must be relative ('/path') or absolute ('https://…')");

/** A call-to-action button: label + href + visual style. */
const ctaSchema = z.object({
  label: z.string().min(1),
  href: hrefSchema,
  style: z.enum(["primary", "secondary"]).default("primary"),
});

/** A plain navigation/footer link: label + href (no style). */
const linkSchema = z.object({
  label: z.string().min(1),
  href: hrefSchema,
});

/* -------------------------------- navbar ---------------------------------- */

const navbar = def({
  type: "navbar",
  description:
    "Top navigation bar with a brand on the left, a short set of nav links, and an optional call-to-action button on the right. Use this once at the very top of the page to give visitors site-wide navigation and a primary action.",
  props: [
    { name: "brandName", type: "string", required: true, description: "The brand or product name shown on the left of the bar. Use the site/company name." },
    { name: "links", type: "linkList", required: true, description: "Between 2 and 6 navigation links ({label, href}) shown in the bar. Use for the main top-level destinations (e.g. Features, Pricing, About)." },
    { name: "cta", type: "link", required: false, description: "Optional single call-to-action button ({label, href, style}) shown at the far right. Use when there is a primary action like Sign up or Get started." },
  ],
  schema: z.object({
    brandName: z.string().min(1),
    links: z.array(linkSchema).min(2).max(6),
    cta: ctaSchema.optional(),
  }),
  render: (props) => `
<nav class="navbar">
  <a class="navbar-brand" href="/">${esc(props.brandName)}</a>
  <ul class="navbar-links">
    ${props.links
      .map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`)
      .join("\n    ")}
  </ul>
  ${props.cta ? `<a class="btn btn-${esc(props.cta.style)}" href="${esc(props.cta.href)}">${esc(props.cta.label)}</a>` : ""}
</nav>`,
});

/* ------------------------------- hero ------------------------------------ */

const hero = def({
  type: "hero",
  description:
    "Top-of-page hero banner with a headline, supporting subheadline, an optional image, and call-to-action buttons. Use exactly once, as the first content section (after the navbar if present).",
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

/* ------------------------------ logoStrip --------------------------------- */

const logoStrip = def({
  type: "logoStrip",
  description:
    "A horizontal row of customer or partner logos for social proof. Use this when the page needs an 'as trusted by' / 'used by' strip to build credibility with recognizable brand logos. Best placed just below the hero or between content sections. Not for navigation, feature lists, or testimonials with quotes.",
  props: [
    {
      name: "heading",
      type: "string",
      required: false,
      description:
        "Optional short, centered eyebrow heading above the logos, e.g. 'Trusted by teams at' or 'As seen in'. Omit for a bare logo row.",
    },
    {
      name: "logos",
      type: "objectList",
      required: true,
      description:
        "The brand/partner logos to display, 3 to 8 items. Each item is { imageAlt, name }: imageAlt describes the logo image for accessibility, name is the company/brand name. Logos render as evenly spaced placeholder images that wrap on small screens.",
    },
  ],
  schema: z.object({
    heading: z.string().min(1).optional(),
    logos: z
      .array(
        z.object({
          imageAlt: z.string().min(1),
          name: z.string().min(1),
        }),
      )
      .min(3)
      .max(8),
  }),
  render: (props) => `
<section class="logo-strip">
  ${props.heading ? `<p class="logo-strip-heading">${esc(props.heading)}</p>` : ""}
  <div class="logo-strip-row">
    ${props.logos
      .map(
        (logo) => `
    <div class="logo-strip-item" title="${esc(logo.name)}">
      ${placeholderImg(logo.imageAlt, 160, 48, "logo")}
    </div>`,
      )
      .join("")}
  </div>
</section>`,
});

/* -------------------------------- stats ----------------------------------- */

const stats = def({
  type: "stats",
  description:
    "A horizontal row of 2–4 headline metrics, each a big bold number with a short caption. Use this to showcase social proof or key figures (e.g. '10k+ active users', '99.9% uptime', '4.8★ rating') as a compact, scannable band — not for prose or feature explanations.",
  props: [
    {
      name: "heading",
      type: "string",
      required: false,
      description: "Optional short section heading shown above the metrics row (e.g. 'By the numbers'). Omit for a bare row of stats.",
    },
    {
      name: "items",
      type: "objectList",
      required: true,
      description: "The metrics to display, min 2 max 4. Each item is { value, label }: 'value' is the big emphasised figure (e.g. '10k+', '99.9%', '$2M'), 'label' is the small caption beneath it (e.g. 'active users'). Use when you have a handful of impactful numbers to highlight.",
    },
  ],
  schema: z.object({
    heading: z.string().min(1).optional(),
    items: z
      .array(
        z.object({
          value: z.string().min(1),
          label: z.string().min(1),
        })
      )
      .min(2)
      .max(4),
  }),
  render: ({ heading, items }) => `
<section class="stats">
  ${heading ? `<h2 class="section-heading">${esc(heading)}</h2>` : ""}
  <div class="stats-row">
    ${items
      .map(
        (s) => `<div class="stat">
      <span class="stat-value">${esc(s.value)}</span>
      <span class="stat-label">${esc(s.label)}</span>
    </div>`
      )
      .join("\n    ")}
  </div>
</section>`,
});

/* ----------------------------- featureGrid -------------------------------- */

const featureGrid = def({
  type: "featureGrid",
  description:
    "A responsive grid of 2-6 feature cards, each with a title and short body, and an optional small icon/illustration. Use this when you want to highlight several product capabilities, benefits, or selling points side by side. Reach for this over a single hero or testimonial when there are multiple parallel points to communicate; provide imageAlt on a feature only when a small visual icon helps.",
  props: [
    { name: "heading", type: "string", required: false, description: "Optional section heading shown above the grid. Use this to label the group of features, e.g. 'Why teams choose us'." },
    { name: "features", type: "objectList", required: true, description: "The list of feature cards (min 2, max 6). Each feature has a title (short label), a body (one or two sentence explanation), and an optional imageAlt that, when present, renders a small 64x64 icon/illustration above the title. Use this for the parallel set of capabilities or benefits to display." },
  ],
  schema: z.object({
    heading: z.string().min(1).optional(),
    features: z
      .array(
        z.object({
          title: z.string().min(1),
          body: z.string().min(1),
          imageAlt: z.string().min(1).optional(),
        }),
      )
      .min(2)
      .max(6),
  }),
  render: ({ heading, features }) => `
<section class="features">
  ${heading ? `<h2 class="section-heading">${esc(heading)}</h2>` : ""}
  <div class="grid">
    ${features
      .map(
        (f) => `<div class="card">
      ${f.imageAlt ? placeholderImg(f.imageAlt, 64, 64, "feature-icon") : ""}
      <h3>${esc(f.title)}</h3>
      <p>${esc(f.body)}</p>
    </div>`,
      )
      .join("\n    ")}
  </div>
</section>`,
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

/* ----------------------------- pricingTable ------------------------------- */

const pricingTable = def({
  type: "pricingTable",
  description:
    'Pricing tiers laid out as a grid of comparable plan cards, each with a name, prominent price (optional period like "/mo"), a bullet list of included features, and a single call-to-action button. Use this when the page needs to present 2-4 subscription/plan options side by side and optionally spotlight one recommended plan.',
  props: [
    {
      name: "heading",
      type: "string",
      required: false,
      description: 'Optional section heading shown above the tiers, e.g. "Pricing" or "Choose your plan". Omit for a heading-less pricing block.',
    },
    {
      name: "tiers",
      type: "objectList",
      required: true,
      description: 'The 2-4 pricing plans to display side by side. Each tier has: name (plan title), price (e.g. "$29" or "Free"), optional period (e.g. "/mo"), features (one feature per line, newline-separated), cta (the sign-up/select button), and optional highlighted flag to spotlight the recommended plan.',
    },
  ],
  schema: z.object({
    heading: z.string().min(1).optional(),
    tiers: z
      .array(
        z.object({
          name: z.string().min(1),
          price: z.string().min(1),
          period: z.string().min(1).optional(),
          features: z.string().min(1),
          cta: ctaSchema,
          highlighted: z.boolean().default(false),
        }),
      )
      .min(2)
      .max(4),
  }),
  render: ({ heading, tiers }) => `
    <section class="pricing">
      ${heading ? `<h2 class="section-heading">${esc(heading)}</h2>` : ""}
      <div class="grid">
        ${tiers
          .map(
            (tier) => `
        <div class="card pricing-tier${tier.highlighted ? " pricing-tier--highlighted" : ""}">
          <h3>${esc(tier.name)}</h3>
          <p class="pricing-price">${esc(tier.price)}${tier.period ? `<span class="pricing-period">${esc(tier.period)}</span>` : ""}</p>
          <ul class="pricing-features">
            ${tier.features
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
              .map((line) => `<li>${esc(line)}</li>`)
              .join("\n            ")}
          </ul>
          <a class="btn btn-${esc(tier.cta.style)}" href="${esc(tier.cta.href)}">${esc(tier.cta.label)}</a>
        </div>`,
          )
          .join("")}
      </div>
    </section>`,
});

/* --------------------------------- faq ------------------------------------ */

const faq = def({
  type: "faq",
  description:
    "Frequently asked questions presented as accessible expand/collapse rows. Use this when the page needs to address common objections, clarify pricing/usage/support details, or reduce buyer hesitation with question-and-answer pairs. Prefer this over plain text when there are 2-10 discrete Q&A items.",
  props: [
    {
      name: "heading",
      type: "string",
      required: false,
      description: 'Optional section heading shown above the questions, e.g. "Frequently asked questions". Omit to render the list with no title.',
    },
    {
      name: "items",
      type: "objectList",
      required: true,
      description: "The Q&A pairs (2-10). Each item has a short question and a concise plain-text answer. Use this for the actual FAQ content.",
    },
  ],
  schema: z.object({
    heading: z.string().min(1).optional(),
    items: z
      .object({
        question: z.string().min(1),
        answer: z.string().min(1),
      })
      .array()
      .min(2)
      .max(10),
  }),
  render: (props) => `
<section class="faq">
  ${props.heading ? `<h2 class="section-heading">${esc(props.heading)}</h2>` : ""}
  <div class="faq-list">
    ${props.items
      .map(
        (item) => `<details class="faq-item">
      <summary>${esc(item.question)}</summary>
      <p>${esc(item.answer)}</p>
    </details>`
      )
      .join("\n    ")}
  </div>
</section>`,
});

/* ------------------------------- gallery ---------------------------------- */

const gallery = def({
  type: "gallery",
  description:
    "Image gallery showing a grid of pictures with optional captions. Use this when the page needs to showcase a collection of related visuals — product shots, portfolio work, event photos, screenshots — rather than text-driven feature cards. Supports 2 to 8 images.",
  props: [
    {
      name: "heading",
      type: "string",
      required: false,
      description: "Optional section heading shown above the gallery. Use this to label the collection, e.g. 'Our Work' or 'Product Gallery'.",
    },
    {
      name: "images",
      type: "objectList",
      required: true,
      description: "The gallery images, 2 to 8 items. Each item has an imageAlt (describe the picture's content for accessibility and placeholder generation) and an optional caption (short text shown beneath the image).",
    },
  ],
  schema: z.object({
    heading: z.string().min(1).optional(),
    images: z
      .array(
        z.object({
          imageAlt: z.string().min(1),
          caption: z.string().min(1).optional(),
        }),
      )
      .min(2)
      .max(8),
  }),
  render: ({ heading, images }) => `
<section class="gallery">
  ${heading ? `<h2 class="section-heading">${esc(heading)}</h2>` : ""}
  <div class="grid">
    ${images
      .map(
        (img) => `<figure class="gallery-item">
      ${placeholderImg(img.imageAlt, 600, 400, "gallery-img")}
      ${img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : ""}
    </figure>`,
      )
      .join("\n    ")}
  </div>
</section>`,
});

/* ------------------------------- richText --------------------------------- */

const richText = def({
  type: "richText",
  description:
    "Generic prose/rich-text block. Use this when you need a free-form section of body copy (intro paragraphs, about text, explanations, terms) that doesn't fit a more structured component. Provide plain prose in `html`; blank lines separate paragraphs. Text is always escaped, so it is safe for arbitrary content.",
  props: [
    { name: "heading", type: "string", required: false, description: "Optional section heading shown above the prose. Use this when the block needs a title; omit for unbroken running text." },
    { name: "html", type: "string", required: true, description: "The prose body as plain text. Use blank lines to separate paragraphs — each becomes its own <p>. Do not include HTML markup; it will be escaped and shown literally." },
  ],
  schema: z.object({
    heading: z.string().min(1).optional(),
    html: z.string().min(1),
  }),
  render: (props) => {
    const paragraphs = props.html
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => `<p>${esc(p)}</p>`)
      .join("\n      ");
    return `<section class="prose">
      ${props.heading ? `<h2 class="section-heading">${esc(props.heading)}</h2>` : ""}
      ${paragraphs}
    </section>`;
  },
});

/* ------------------------------ contactForm ------------------------------- */

const contactForm = def({
  type: "contactForm",
  description:
    "A semantic contact form with labelled text/email/textarea fields and a submit button (no backend wiring). Use this when the page needs a 'contact us', enquiry, signup, or lead-capture form. Fields are configurable; the form posts to an optional action URL.",
  props: [
    { name: "heading", type: "string", required: false, description: "Optional form heading shown above the fields (e.g. 'Get in touch'). Omit for a bare form." },
    { name: "fields", type: "objectList", required: true, description: "1 to 6 form fields to collect. Each is { name, label, type:'text'|'email'|'textarea', required }. Use this to define what information the visitor submits (e.g. name, email, message)." },
    { name: "submitLabel", type: "string", required: true, description: "Text on the submit button (e.g. 'Send message', 'Request a demo')." },
    { name: "action", type: "string", required: false, description: "Optional URL the form posts to. If omitted, no action attribute is rendered. Method is always POST." },
  ],
  schema: z.object({
    heading: z.string().min(1).optional(),
    fields: z.array(z.object({
      name: z.string().min(1),
      label: z.string().min(1),
      type: z.enum(["text", "email", "textarea"]),
      required: z.boolean(),
    })).min(1).max(6),
    submitLabel: z.string().min(1),
    action: hrefSchema.optional(),
  }),
  render: ({ heading, fields, submitLabel, action }) => `
    <section class="contact">
      ${heading ? `<h2 class="section-heading">${esc(heading)}</h2>` : ""}
      <form class="contact-form"${action ? ` action="${esc(action)}"` : ""} method="post">
        ${fields.map((f) => `<div class="form-field">
          <label for="${esc(f.name)}">${esc(f.label)}</label>
          ${f.type === "textarea"
            ? `<textarea id="${esc(f.name)}" name="${esc(f.name)}"${f.required ? " required" : ""}></textarea>`
            : `<input id="${esc(f.name)}" name="${esc(f.name)}" type="${esc(f.type)}"${f.required ? " required" : ""} />`}
        </div>`).join("\n        ")}
        <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
      </form>
    </section>`,
});

/* --------------------------------- ctaBanner ------------------------------ */

const ctaBanner = def({
  type: "ctaBanner",
  description:
    "A full-width closing call-to-action band with a heading and one button. Use once, near the bottom.",
  props: [
    { name: "heading", type: "string", required: true, description: "The closing prompt, e.g. 'Ready to get started?'" },
    { name: "cta", type: "link", required: true, description: "A single CTA: { label, href, style }." },
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

/**
 * All components, keyed by type. Add a component here and the manifest, prompt,
 * factory (and, from Phase 2, the CMS type definitions) all pick it up. Ordered
 * roughly by where each tends to appear on a page so the manifest reads well.
 */
export const COMPONENTS: Record<string, Component<any>> = {
  navbar,
  hero,
  logoStrip,
  stats,
  featureGrid,
  testimonial,
  pricingTable,
  faq,
  gallery,
  richText,
  contactForm,
  ctaBanner,
};

export const COMPONENT_TYPES = Object.keys(COMPONENTS);
