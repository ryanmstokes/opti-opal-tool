import { buildManifest } from "./factory.js";

/**
 * A worked example that obeys every rule: valid types, valid props, image
 * described via alt text only (no URLs), sensible section order. The AI is
 * shown this so it returns the same shape.
 */
export const EXAMPLE_CONFIG = {
  title: "Acme Analytics — Ship Faster",
  description: "Real-time product analytics for teams that move fast.",
  theme: { accent: "#7c3aed", font: "system" },
  sections: [
    {
      type: "hero",
      props: {
        headline: "Know what your users do — instantly",
        subheadline:
          "Acme Analytics turns raw events into clear answers, so your team ships the right thing.",
        imageAlt: "dashboard showing a live user activity chart",
        ctas: [
          { label: "Start free", href: "/signup", style: "primary" },
          { label: "Book a demo", href: "/demo", style: "secondary" },
        ],
      },
    },
    {
      type: "featureGrid",
      props: {
        heading: "Why teams choose Acme",
        features: [
          { title: "Live dashboards", body: "See events the moment they happen, no batch delays." },
          { title: "No-code funnels", body: "Build conversion funnels by dragging and dropping steps." },
          { title: "Privacy-first", body: "EU-hosted, GDPR-ready, and cookieless by default." },
        ],
      },
    },
    {
      type: "testimonial",
      props: {
        quote: "We cut our reporting time from days to minutes.",
        author: "Jordan Lee",
        role: "Head of Growth, Northwind",
      },
    },
    {
      type: "ctaBanner",
      props: {
        heading: "Ready to see your data clearly?",
        cta: { label: "Start free", href: "/signup", style: "primary" },
      },
    },
  ],
};

/**
 * Build the full instruction string handed to the AI. In Opal this lives in the
 * agent's prompt/Inputs so the model produces a config the tool can render.
 */
export const buildPrompt = (): string => {
  const manifest = buildManifest();
  return `You generate landing pages by producing a JSON CONFIG. You do NOT write HTML.
A separate factory converts your config into HTML, so your only job is to return a valid config object.

## Available components
${JSON.stringify(manifest.components, null, 2)}

## Page config shape
${JSON.stringify(manifest.pageConfigShape, null, 2)}

## Rules
1. Return ONLY a single JSON object matching the page config shape. No prose, no markdown fences.
2. Every section's "type" MUST be one of the component types above.
3. Every section's "props" MUST match that component's prop spec exactly. Include all required props.
4. NEVER provide image URLs. For any image, supply an "imageAlt" describing it; the factory inserts a placeholder.
5. Use "hero" exactly once as the first section. Use "ctaBanner" at most once, near the end.
6. Keep copy concise and benefit-led. Headlines short; bodies one or two sentences.
7. Pick a theme.accent hex color that fits the brand/topic.

## Example (follow this shape exactly)
${JSON.stringify(EXAMPLE_CONFIG, null, 2)}

Now produce a config for the user's request.`;
};
