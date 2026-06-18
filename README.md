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
  zod schema, its manifest spec, and its render function. Manifest and factory
  both derive from this, so they can never drift.
- **`src/factory.ts`** — page config schema, `buildManifest()`, and `renderPage()`.
  Invalid sections are skipped with a warning rather than failing the whole page.
- **`src/prompt.ts`** — `buildPrompt()` assembles the manifest + rules + a worked
  example; this is what the agent reads to produce a valid config.
- **`src/server.ts`** — two Opal tools:
  - `get_landing_page_spec` — returns manifest + prompt + example (call first).
  - `render_landing_page` — takes a config, returns HTML.

## Image placeholders

The AI never invents image URLs. It supplies `imageAlt`; the factory emits
`{{IMAGE:1200x600:slug}}`. A downstream step or human swaps these for real assets.

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
