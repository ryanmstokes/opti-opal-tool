# Opal Landing Page Generator

A config-driven landing page generator, exposed as an Optimizely Opal tool.

## How it works

The LLM does the creative work; the tool does deterministic rendering.

```
Component registry  ──derives──>  Manifest ──┐
(schema+manifest+render, one object)         ├─> Prompt (manifest + rules + example) ──> AI returns CONFIG
                    └────────derives────────> Factory <──────────────────────────────────────┘
                                                 │
                                                 └─> complete HTML (images as {{IMAGE:WxH:slug}} placeholders)
```

- **`src/components.ts`** — the registry. Each component is ONE object owning its
  zod schema, its manifest spec, its render function, and (optionally) its `cms`
  descriptor. Manifest, factory, prompt and the CMS type generator all derive
  from this, so they can never drift. Components: `navbar`, `hero`, `logoStrip`,
  `stats`, `featureGrid`, `testimonial`, `pricingTable`, `faq`, `gallery`,
  `richText`, `contactForm`, `ctaBanner`.
- **`src/factory.ts`** — page config schema, `buildManifest()`, and `renderPage()`,
  which also returns one `ImageSlot` per image placeholder. Invalid sections are
  skipped with a warning rather than failing the whole page.
- **`src/prompt.ts`** — `buildPrompt()` assembles the manifest + rules + a full
  worked example; this is what the agent reads to produce a valid config.
- **`src/cmsTypes.ts`** — `buildContentTypeDefinitions()`: ordered
  `cms_create_content_type` payloads derived from the registry.
- **`src/cmsPayload.ts`** — `buildExperiencePayload()`: a validated config → the
  exact `cms_update_content_item` upsert for an editable Optimizely Experience.
- **`src/cmsHelpers.ts`** — pure CMS value builders (`link`, `contentRef`,
  `richTextHtml`) and the gotcha-assertion guards.
- **`src/server.ts`** — five Opal tools:
  - `get_landing_page_spec` — returns manifest + prompt + example (call first).
  - `render_landing_page` — takes a config, returns `{ html, images, warnings, instructions }`.
  - `apply_images` — deterministically swaps image placeholders for real URLs.
  - `get_cms_content_types` — ordered CMS content-type definitions (one-time setup).
  - `build_cms_experience` — config → CMS experience upsert payload.

See [docs/AGENT_INSTRUCTIONS.md](docs/AGENT_INSTRUCTIONS.md) for the exact agent
orchestration (HTML path and CMS path).

## Image placeholders

The AI never invents image URLs. It supplies `imageAlt`; the factory emits
`{{IMAGE:1200x600:slug}}` and lists every placeholder in the render response's
`images` array. The agent fills each `url` and calls `apply_images` (a literal,
deterministic swap) — it never edits the HTML itself. On the CMS path, image
references are left unset in v1 and surfaced as warnings to fill in the editor.

## Scripts

```bash
npm run build         # tsc
npm run demo          # render the worked example → demo-output.html
npm run test:images   # apply_images round-trip test
npm run test:cms      # experience payload + gotcha-guard test
npm run cms:types     # print ordered CMS content-type definitions
```

## Run

```bash
npm install
npm run demo                  # renders the example → demo-output.html
OPAL_BEARER_TOKEN=$(openssl rand -hex 32) npm run dev
```

## Register in Opal

1. Deploy to a public HTTPS URL (Vercel/Render/AWS/etc). `/discovery` must be
   anonymous; execution endpoints are bearer-guarded.
2. Opal admin → Tools → Add tool registry → set Discovery URL to
   `https://your-host/discovery` and paste your `OPAL_BEARER_TOKEN`.
3. Put the output of `get_landing_page_spec` (or `buildPrompt()`) into your
   agent's instructions so it returns valid configs, then grant it both tools.

## Add a component

Add one object to `COMPONENTS` in `components.ts` (type + description + props +
schema + render). The manifest, prompt, and factory pick it up automatically.

Opal Tools are in beta; your CSM must enable them for your org.
