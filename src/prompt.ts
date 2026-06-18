import { buildManifest } from "./factory.js";

/**
 * A FULL, realistic worked example. The model copies the example's quality bar,
 * so the example must BE the quality bar: a coherent fictional product
 * ("Tracepoint", an observability SaaS) exercising most components in a sensible
 * order, with specific benefit-led copy, differentiated pricing, real FAQ
 * answers, and designer-grade imageAlt. Every image is described via alt text
 * only — never a URL. This config validates against all schemas and renders with
 * zero warnings. Inline comments explain WHY each choice was made.
 */
export const EXAMPLE_CONFIG = {
  title: "Tracepoint — Trace-Native Observability for Distributed Systems",
  description:
    "Tracepoint correlates traces, logs, and metrics in a single timeline so engineers can find the root cause of a production incident in minutes, not hours.",
  // Violet reads as a credible modern dev-tooling brand and matches the
  // latency-spike imagery described in the hero imageAlt.
  theme: { accent: "#5B5BD6", font: "system" },
  sections: [
    // navbar first: site-wide nav + one primary action (Start free).
    {
      type: "navbar",
      props: {
        brandName: "Tracepoint",
        links: [
          { label: "Product", href: "/product" },
          { label: "Docs", href: "/docs" },
          { label: "Pricing", href: "/pricing" },
          { label: "Changelog", href: "/changelog" },
        ],
        cta: { label: "Start free", href: "/signup", style: "primary" },
      },
    },
    // hero pairs a primary + secondary CTA; the headline is a concrete,
    // benefit-led promise (a number + a timeframe), not a generic slogan.
    {
      type: "hero",
      props: {
        headline: "Find the root cause of an incident in under 5 minutes",
        subheadline:
          "Tracepoint stitches every trace, log line, and metric into one timeline keyed by request ID, so on-call stops tab-hopping between four dashboards during an outage. Instrument once with OpenTelemetry and see the full path of any request across every service.",
        // imageAlt describes the exact shot so the factory can placeholder it
        // and a designer can source it.
        imageAlt:
          "Dark-mode incident timeline showing a slow checkout request expanded into a waterfall of database, cache, and payment-API spans, with the 1.8s latency spike highlighted in violet",
        ctas: [
          { label: "Start free — no card", href: "/signup", style: "primary" },
          { label: "Read the docs", href: "/docs", style: "secondary" },
        ],
      },
    },
    // social proof early: a trust strip of recognizable (fictional) customers.
    {
      type: "logoStrip",
      props: {
        heading: "Trusted by platform teams shipping at scale",
        logos: [
          { imageAlt: "Northwind Freight wordmark in monochrome", name: "Northwind Freight" },
          { imageAlt: "Cobalt Health logo with a single-line caduceus mark", name: "Cobalt Health" },
          { imageAlt: "Lumen Retail lowercase wordmark", name: "Lumen Retail" },
          { imageAlt: "Parallax Games stacked logotype", name: "Parallax Games" },
          { imageAlt: "Meridian Bank serif wordmark", name: "Meridian Bank" },
        ],
      },
    },
    // stats reinforce the hero claim with plausible, specific figures.
    {
      type: "stats",
      props: {
        heading: "What teams see after switching",
        items: [
          { value: "73%", label: "lower mean time to resolution in the first 90 days" },
          { value: "4.2T", label: "spans ingested across customer fleets each month" },
          { value: "30s", label: "median lag from event to searchable in the UI" },
          { value: "99.95%", label: "ingest API uptime over the trailing 12 months" },
        ],
      },
    },
    // featureGrid: 6 DISTINCT benefits, each with a supporting sentence; a few
    // carry imageAlt where a visual helps. No repetition, no filler.
    {
      type: "featureGrid",
      props: {
        heading: "Built for the engineer holding the pager",
        features: [
          {
            title: "One timeline, three signals",
            body: "Traces, logs, and metrics share a single time axis keyed by trace ID. Click a latency spike on a chart and jump straight to the exact spans and log lines that produced it.",
            imageAlt:
              "Split-pane view with a latency line chart on top and the matching trace waterfall and log lines synced below it on a shared time cursor",
          },
          {
            title: "Drop-in OpenTelemetry",
            body: "Point your existing OTLP exporter at our endpoint and data flows in within seconds. No proprietary agent, no per-language SDK rewrite, and no vendor lock-in on your instrumentation.",
          },
          {
            title: "Pay for what you keep",
            body: "Tail-based sampling keeps every errored and slow trace while discarding the noise, so you store the 5% that matters. Most teams cut ingest volume by half without losing a single failing request.",
            imageAlt:
              "Funnel diagram showing 100% of raw spans on the left narrowing to a retained slice of error and high-latency traces on the right",
          },
          {
            title: "Alerts that point at a cause",
            body: "Define SLOs on any span attribute and get paged with the offending trace already attached. The alert links to the slowest exemplar, so on-call starts debugging instead of searching.",
          },
          {
            title: "Service map from real traffic",
            body: "We build a live dependency graph from actual request paths, not a static config file. Spot a newly introduced N+1 query or a service talking to a database it never touched before.",
            imageAlt:
              "Node-and-edge service dependency map with edge thickness scaled by request volume and two edges flagged red for elevated error rate",
          },
          {
            title: "Query in plain SQL",
            body: "Run ad-hoc queries against raw span data with the SQL you already know — no custom query language to learn. Save any query as a dashboard panel or an alert in one click.",
          },
        ],
      },
    },
    // testimonial closes a business outcome, not just a metric.
    {
      type: "testimonial",
      props: {
        quote:
          "We replaced three separate tools with Tracepoint and our on-call rotation stopped dreading 2 a.m. pages. Last quarter a checkout regression that used to take an hour to trace was root-caused in four minutes — the slow span was right there on the alert. It paid for itself the first time it saved us a midnight bridge call.",
        author: "Priya Nadkarni",
        role: "Staff Engineer, Platform Reliability at Lumen Retail",
      },
    },
    // pricingTable: 3 tiers with a clear upgrade ladder ("Everything in X, plus:").
    // The MIDDLE tier is highlighted to anchor the choice toward the paid plan.
    {
      type: "pricingTable",
      props: {
        heading: "Pricing that scales with your span volume, not your headcount",
        tiers: [
          {
            name: "Hobby",
            price: "$0",
            period: "forever",
            features:
              "50M spans per month\n7-day retention\n3 user seats\nOpenTelemetry ingest\nCommunity Slack support",
            cta: { label: "Start free", href: "/signup", style: "secondary" },
            highlighted: false,
          },
          {
            name: "Team",
            price: "$99",
            period: "/month",
            features:
              "Everything in Hobby, plus:\n1B spans per month\n30-day retention\nUnlimited seats\nTail-based sampling\nSLO alerting with PagerDuty integration\nEmail and chat support",
            cta: { label: "Start 14-day trial", href: "/signup?plan=team", style: "primary" },
            highlighted: true,
          },
          {
            name: "Enterprise",
            price: "Custom",
            period: "annual contract",
            features:
              "Everything in Team, plus:\nUnlimited spans\nCustom retention up to 13 months\nSAML SSO and full audit logs\nDedicated ingest region (US or EU)\n99.95% uptime SLA\nNamed solutions engineer",
            cta: { label: "Talk to sales", href: "/contact", style: "secondary" },
            highlighted: false,
          },
        ],
      },
    },
    // faq answers the real objections an engineer raises before signing up.
    {
      type: "faq",
      props: {
        heading: "Questions engineers ask before they sign up",
        items: [
          {
            question: "Do I have to replace my existing instrumentation?",
            answer:
              "No. Tracepoint speaks native OTLP, so if you already emit OpenTelemetry you just change the export endpoint and add an API key. If you haven't instrumented yet, our auto-instrumentation libraries cover the common frameworks for Go, Java, Node, Python, and Ruby, and most teams see their first trace within ten minutes.",
          },
          {
            question: "How does billing work if my traffic spikes?",
            answer:
              "You're billed on spans ingested after sampling, not raw volume, and tail-based sampling keeps that number predictable by dropping healthy noise. If you exceed your plan's monthly allotment we keep ingesting and bill the overage at a flat per-million rate — we never silently drop your error traces.",
          },
          {
            question: "Where is my data stored and who can see it?",
            answer:
              "Data is encrypted in transit and at rest and stored in the region you choose at signup, with US and EU options on every paid plan. Enterprise customers can pin a dedicated ingest region and get SAML SSO plus full audit logging of every query run against their data.",
          },
          {
            question: "Can I export my data or take it with me if I leave?",
            answer:
              "Yes. Raw spans are queryable over SQL and exportable to Parquet at any time, and our ingest format is standard OTLP with no proprietary lock-in. Cancel whenever you like — there are no annual commitments on the Hobby or Team plans.",
          },
        ],
      },
    },
    // contactForm uses valid field types and a relative action; no backend wiring.
    {
      type: "contactForm",
      props: {
        heading: "Talk to an engineer about your stack",
        fields: [
          { name: "name", label: "Full name", type: "text", required: true },
          { name: "email", label: "Work email", type: "email", required: true },
          { name: "company", label: "Company", type: "text", required: false },
          { name: "spanVolume", label: "Approximate monthly span volume", type: "text", required: false },
          { name: "message", label: "What are you trying to debug faster?", type: "textarea", required: true },
        ],
        submitLabel: "Request a demo",
        action: "/api/contact",
      },
    },
    // ctaBanner: one closing CTA that echoes the hero's "first trace in minutes" hook.
    {
      type: "ctaBanner",
      props: {
        heading: "Ship your first trace in the next ten minutes",
        cta: { label: "Start free — no card required", href: "/signup", style: "primary" },
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
1. Return ONLY a single JSON object matching the page config shape. No prose, no explanations, no markdown code fences — just the JSON.
2. Every section's "type" MUST be one of the component types listed in the manifest above.
3. Every section's "props" MUST match that component's prop spec exactly. Include all required props and respect every min/max on arrays.
4. NEVER provide image URLs. For any image, supply the described alt text only (e.g. "imageAlt"); the factory inserts a placeholder and a later step swaps in the real asset.
5. Structure & uniqueness:
   - Use "navbar" at most once; if present it MUST be the first section.
   - Use "hero" at most once; it MUST be the first content section (directly after the navbar, or first if there is no navbar).
   - Use "ctaBanner" at most once, as the closing section.
6. All hrefs must be relative ("/signup") or absolute ("https://…").
7. Compose a COMPLETE page. A strong landing page usually flows: navbar → hero → social proof (logoStrip / stats) → featureGrid → testimonial → pricingTable → faq → contactForm → ctaBanner. Use the components that fit the brief; never pad with empty sections, but never ship a thin two-section page either.
8. COPY QUALITY — this is what separates a real page from a templated one:
   - Headlines are specific and benefit-led ("Cut deploy time from hours to minutes"), never generic ("The best tool for teams").
   - Subheadlines and bodies are one or two real sentences with concrete detail. No lorem ipsum, and no one-line filler like "Save up to $800. Limited stock."
   - Each feature names a distinct, concrete benefit with a supporting sentence — no repetition, no filler.
   - FAQ answers are real answers (2–3 sentences). Pricing tiers have differentiated feature lists. Stats use plausible, specific numbers.
   - imageAlt strings are descriptive enough to brief a designer.
9. Pick a theme.accent hex color that fits the brand/topic.

## Quality checklist (self-apply before returning)
- Is every headline specific and benefit-led, not generic?
- Does every section earn its place — no filler, no one-line sections?
- Are feature / FAQ / pricing entries distinct and concrete, with no repetition?
- Are all images described via alt text only, with NO urls anywhere?
- Does the section order obey the navbar / hero / ctaBanner rules?
- Is the output a single raw JSON object — no markdown fences, no prose?

## Example (follow this shape and quality bar)
${JSON.stringify(EXAMPLE_CONFIG, null, 2)}

Now produce a config for the user's request.`;
};
