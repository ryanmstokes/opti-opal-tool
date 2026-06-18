import { z } from "zod";
import { esc, placeholderImg } from "./html.js";
import { link, richTextHtml } from "./cmsHelpers.js";

/**
 * A Component is the single source of truth for one building block:
 *   - `schema`   validates the props the AI provides
 *   - `manifest` is the human/AI-readable description of those props
 *   - `render`   turns validated props into an HTML fragment
 *   - `cms`      (optional) maps the component to an Optimizely CMS content type
 *
 * Because the manifest, renderer and CMS mapping live in the same object, they
 * cannot drift apart. The factory, the AI prompt and the CMS type generator all
 * derive from this registry.
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

/* ------------------------------ CMS metadata ------------------------------ */

/**
 * CMS property types we emit. Mostly the brief's set; "boolean" is added because
 * LpPricingTier.highlighted needs it (Optimizely supports a boolean property).
 */
export type CmsPropType =
  | "string"
  | "richText"
  | "link"
  | "boolean"
  | "contentReference"
  | "contentArea"
  | "linkCollection"
  | "stringList";

export interface CmsPropDef {
  name: string;
  cmsType: CmsPropType;
  /** For contentReference / contentArea: the CMS type keys this accepts. */
  allowedTypes?: string[];
  /** For contentArea: the item content-type key its entries are built as. */
  itemType?: string;
}

/**
 * CMS descriptor for a page-level component. `typeKey` is the SINGLE place a
 * component's CMS type name is defined — a Phase-7 rename (e.g. mapping onto an
 * existing Hero block) is a one-line change here. `mapProps` turns validated
 * props into CMS-ready property VALUES, applying the gotchas (links as objects,
 * lists as arrays, refs as bare strings, richText as HTML).
 */
export interface CmsComponentDef<TProps = unknown> {
  typeKey: string;
  baseType?: "_component";
  compositionBehaviors?: string[];
  properties: CmsPropDef[];
  mapProps: (props: TProps) => Record<string, unknown>;
}

/** A broken-out item content type used inside a parent's content area. */
export interface CmsItemTypeDef {
  typeKey: string;
  baseType: "_component";
  properties: CmsPropDef[];
}

export interface Component<TProps> {
  type: string;
  description: string;
  props: PropSpec[];
  schema: z.ZodType<TProps>;
  render: (props: TProps) => string;
  cms?: CmsComponentDef<TProps>;
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

/*
 * v1 CMS LIST-MODELLING DECISION (confirmed with stakeholder):
 *   - BROKEN OUT as real item _component types in content areas (fully editable):
 *       featureGrid → LpFeature, pricingTable → LpPricingTier, gallery → LpGalleryImage
 *   - COLLAPSED onto the parent as richText / stringList (fewer types for v1):
 *       stats, faq, navbar links, logoStrip logos, contactForm fields
 * Rationale: fewer CMS types to create/maintain for v1; the broken-out three are
 * the ones whose items most benefit from independent editing. Each collapse is a
 * known tradeoff with a documented Phase-8 upgrade path (see per-component notes).
 */

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
  // v1 collapses links to a stringList of "Label|href". Phase-8 upgrade: model
  // `links` as a native linkCollection (structured, no extra content type).
  cms: {
    typeKey: "LpNavbar",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "brandName", cmsType: "string" },
      { name: "links", cmsType: "stringList" },
      { name: "cta", cmsType: "link" },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = {
        brandName: p.brandName,
        links: p.links.map((l) => `${l.label}|${l.href}`),
      };
      if (p.cta) out.cta = link(p.cta.label, p.cta.href);
      return out;
    },
  },
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
  // heroImage is left unset in v1 (the editor fills it via the asset picker); the
  // payload builder emits a warning listing the image described by imageAlt.
  cms: {
    typeKey: "LpHero",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "headline", cmsType: "string" },
      { name: "subheadline", cmsType: "string" },
      { name: "heroImage", cmsType: "contentReference", allowedTypes: ["_image"] },
      { name: "primaryCta", cmsType: "link" },
      { name: "secondaryCta", cmsType: "link" },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = { headline: p.headline };
      if (p.subheadline) out.subheadline = p.subheadline;
      const ctas = p.ctas ?? [];
      if (ctas[0]) out.primaryCta = link(ctas[0].label, ctas[0].href);
      if (ctas[1]) out.secondaryCta = link(ctas[1].label, ctas[1].href);
      return out;
    },
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
  // v1 collapses logos to a stringList of names; the logo IMAGES are left for the
  // editor (warned). Phase-8 upgrade: break out LpLogo (logo:contentReference,
  // name:string) into a content area so each logo holds its real asset.
  cms: {
    typeKey: "LpLogoStrip",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "heading", cmsType: "string" },
      { name: "logos", cmsType: "stringList" },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = { logos: p.logos.map((l) => l.name) };
      if (p.heading) out.heading = p.heading;
      return out;
    },
  },
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
  // v1 collapses metrics to a stringList of "value — label". Phase-8 upgrade:
  // break out LpStat (value:string, label:string) into a content area.
  cms: {
    typeKey: "LpStats",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "heading", cmsType: "string" },
      { name: "items", cmsType: "stringList" },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = {
        items: p.items.map((s) => `${s.value} — ${s.label}`),
      };
      if (p.heading) out.heading = p.heading;
      return out;
    },
  },
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
  // BROKEN OUT: each feature is an LpFeature item in a content area, so a
  // marketer edits/reorders features individually. Per-feature icon is unset in v1.
  cms: {
    typeKey: "LpFeatureGrid",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "heading", cmsType: "string" },
      { name: "features", cmsType: "contentArea", itemType: "LpFeature", allowedTypes: ["LpFeature"] },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = {
        features: p.features.map((f) => ({
          contentType: "LpFeature",
          content: { title: f.title, body: richTextHtml(f.body) },
        })),
      };
      if (p.heading) out.heading = p.heading;
      return out;
    },
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
  cms: {
    typeKey: "LpTestimonial",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "quote", cmsType: "richText" },
      { name: "author", cmsType: "string" },
      { name: "role", cmsType: "string" },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = {
        quote: richTextHtml(p.quote),
        author: p.author,
      };
      if (p.role) out.role = p.role;
      return out;
    },
  },
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
  // BROKEN OUT: each tier is an LpPricingTier item in a content area. Its feature
  // lines become a stringList; cta a Link object; highlighted a boolean.
  cms: {
    typeKey: "LpPricingTable",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "heading", cmsType: "string" },
      { name: "tiers", cmsType: "contentArea", itemType: "LpPricingTier", allowedTypes: ["LpPricingTier"] },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = {
        tiers: p.tiers.map((t) => ({
          contentType: "LpPricingTier",
          content: {
            name: t.name,
            price: t.price,
            period: t.period ?? "",
            features: t.features
              .split("\n")
              .map((x) => x.trim())
              .filter((x) => x.length > 0),
            cta: link(t.cta.label, t.cta.href),
            highlighted: t.highlighted,
          },
        })),
      };
      if (p.heading) out.heading = p.heading;
      return out;
    },
  },
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
  // v1 collapses the Q&A pairs to a single richText blob (the marketer edits FAQs
  // as HTML rather than discrete items). KNOWN TRADEOFF, not an accident — the
  // obvious Phase-8 upgrade is to break out LpFaqItem (question:string,
  // answer:richText) into a content area for per-item editing.
  cms: {
    typeKey: "LpFaq",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "heading", cmsType: "string" },
      { name: "faqs", cmsType: "richText" },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = {
        faqs: p.items
          .map((i) => `<h3>${esc(i.question)}</h3>${richTextHtml(i.answer)}`)
          .join(""),
      };
      if (p.heading) out.heading = p.heading;
      return out;
    },
  },
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
  // BROKEN OUT: each image is an LpGalleryImage item in a content area. The image
  // ref itself is unset in v1 (editor fills it); the caption is carried through.
  cms: {
    typeKey: "LpGallery",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "heading", cmsType: "string" },
      { name: "images", cmsType: "contentArea", itemType: "LpGalleryImage", allowedTypes: ["LpGalleryImage"] },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = {
        images: p.images.map((img) => {
          const content: Record<string, unknown> = {};
          if (img.caption) content.caption = img.caption;
          return { contentType: "LpGalleryImage", content };
        }),
      };
      if (p.heading) out.heading = p.heading;
      return out;
    },
  },
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
  cms: {
    typeKey: "LpRichText",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "heading", cmsType: "string" },
      { name: "body", cmsType: "richText" },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = { body: richTextHtml(p.html) };
      if (p.heading) out.heading = p.heading;
      return out;
    },
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
  // v1 collapses fields to a stringList of "label|type|required". Phase-8 upgrade:
  // break out LpFormField (name, label, fieldType, required) into a content area.
  cms: {
    typeKey: "LpContactForm",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "heading", cmsType: "string" },
      { name: "fields", cmsType: "stringList" },
      { name: "submitLabel", cmsType: "string" },
      { name: "action", cmsType: "string" },
    ],
    mapProps: (p) => {
      const out: Record<string, unknown> = {
        fields: p.fields.map((f) => `${f.label}|${f.type}|${f.required ? "required" : "optional"}`),
        submitLabel: p.submitLabel,
      };
      if (p.heading) out.heading = p.heading;
      if (p.action) out.action = p.action;
      return out;
    },
  },
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
  cms: {
    typeKey: "LpCtaBanner",
    baseType: "_component",
    compositionBehaviors: ["sectionEnabled"],
    properties: [
      { name: "heading", cmsType: "string" },
      { name: "cta", cmsType: "link" },
    ],
    mapProps: (p) => ({
      heading: p.heading,
      cta: link(p.cta.label, p.cta.href),
    }),
  },
});

/* --------------------------- item content types --------------------------- */

/**
 * Broken-out item _component types referenced by parent content areas. These are
 * NOT page-level components (no `sectionEnabled`, no render) — they live inside a
 * parent's content area. The type generator emits each of these BEFORE its parent.
 */
export const ITEM_CMS_TYPES: CmsItemTypeDef[] = [
  {
    typeKey: "LpFeature",
    baseType: "_component",
    properties: [
      { name: "title", cmsType: "string" },
      { name: "body", cmsType: "richText" },
      { name: "icon", cmsType: "contentReference", allowedTypes: ["_image"] },
    ],
  },
  {
    typeKey: "LpPricingTier",
    baseType: "_component",
    properties: [
      { name: "name", cmsType: "string" },
      { name: "price", cmsType: "string" },
      { name: "period", cmsType: "string" },
      { name: "features", cmsType: "stringList" },
      { name: "cta", cmsType: "link" },
      { name: "highlighted", cmsType: "boolean" },
    ],
  },
  {
    typeKey: "LpGalleryImage",
    baseType: "_component",
    properties: [
      { name: "image", cmsType: "contentReference", allowedTypes: ["_image"] },
      { name: "caption", cmsType: "string" },
    ],
  },
];

/* ------------------------------- registry --------------------------------- */

/**
 * All components, keyed by type. Add a component here and the manifest, prompt,
 * factory and CMS type definitions all pick it up. Ordered roughly by where each
 * tends to appear on a page so the manifest reads well.
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
