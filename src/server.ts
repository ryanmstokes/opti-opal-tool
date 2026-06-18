import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z, ZodError } from "zod";
import {
  pageConfigSchema,
  buildManifest,
  renderPage,
  RENDER_INSTRUCTIONS,
} from "./factory.js";
import { applyImages, type ImageSlot } from "./html.js";
import { buildPrompt, EXAMPLE_CONFIG } from "./prompt.js";

const PORT = Number(process.env.PORT ?? 3000);
const OPAL_BEARER_TOKEN = process.env.OPAL_BEARER_TOKEN ?? "";

const app = express();
app.use(express.json({ limit: "2mb" }));

const requireBearer = (req: Request, res: Response, next: NextFunction) => {
  if (!OPAL_BEARER_TOKEN) {
    return res.status(500).json({ error: "Server misconfigured: OPAL_BEARER_TOKEN not set." });
  }
  const header = req.get("authorization") ?? "";
  const expected = `Bearer ${OPAL_BEARER_TOKEN}`;
  if (header.length !== expected.length || header !== expected) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  next();
};

/** Pull params whether Opal sends them flat or nested under "parameters". */
const getParams = (body: unknown): unknown =>
  body && typeof body === "object" && "parameters" in (body as object)
    ? (body as Record<string, unknown>).parameters
    : body;

/* ------------------------------- discovery -------------------------------- */

app.get("/discovery", (_req, res) => {
  res.json({
    functions: [
      {
        name: "get_landing_page_spec",
        description:
          "Returns the component manifest, the page config shape, the authoring rules, and a worked example. Call this FIRST to learn how to build a landing page config, then build a config and pass it to render_landing_page.",
        endpoint: "/tools/get_landing_page_spec",
        http_method: "POST",
        parameters: [],
      },
      {
        name: "render_landing_page",
        description:
          "Renders a landing page config into a complete, styled, self-contained HTML document. Returns { html, images, warnings, instructions }. Images are emitted as {{IMAGE:WxH:slug}} placeholders and listed in `images` (one slot per placeholder, url:null). You MUST return the html to the user EXACTLY as provided — do not edit, reformat or regenerate it. The ONLY permitted change is replacing image placeholders, which you do by filling each image's `url` and calling apply_images — never by editing the html yourself. See the `instructions` field.",
        endpoint: "/tools/render_landing_page",
        http_method: "POST",
        parameters: [
          {
            name: "config",
            type: "object",
            description:
              "A page config object: { title, description?, theme?, sections[] }. See get_landing_page_spec for the exact shape and rules.",
            required: true,
          },
        ],
      },
      {
        name: "apply_images",
        description:
          "Deterministically replaces {{IMAGE:WxH:slug}} placeholders in a rendered page with real asset URLs. Pass the html from render_landing_page and the same images array with each url filled in (leave url null for any image you don't have yet). Returns { html, warnings }; warnings list any placeholder left unresolved. This is the ONLY way to put images into the page — do NOT edit the html string by hand.",
        endpoint: "/tools/apply_images",
        http_method: "POST",
        parameters: [
          {
            name: "html",
            type: "string",
            description: "The exact html string returned by render_landing_page.",
            required: true,
          },
          {
            name: "images",
            type: "array",
            description:
              "The images array from render_landing_page, each item { placeholder, alt, width, height, url }. Fill `url` for images you have; leave null otherwise.",
            required: true,
          },
        ],
      },
    ],
  });
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

/* ------------------------------- tool 1 ----------------------------------- */

app.post("/tools/get_landing_page_spec", requireBearer, (_req, res) => {
  res.json({
    manifest: buildManifest(),
    prompt: buildPrompt(),
    example: EXAMPLE_CONFIG,
  });
});

/* ------------------------------- tool 2 ----------------------------------- */

const renderParamsSchema = pageConfigSchema; // config IS the param payload

app.post("/tools/render_landing_page", requireBearer, (req, res) => {
  try {
    const params = getParams(req.body) as Record<string, unknown>;
    // Accept either { config: {...} } or the config object directly.
    const raw =
      params && typeof params === "object" && "config" in params
        ? params.config
        : params;
    const config = renderParamsSchema.parse(raw);
    const { html, images, warnings } = renderPage(config);
    res.json({ html, images, warnings, instructions: RENDER_INSTRUCTIONS });
  } catch (err) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid config", details: err.issues });
    }
    console.error("render_landing_page failed:", err);
    res.status(500).json({ error: "Render failed." });
  }
});

/* ------------------------------- tool 3 ----------------------------------- */

/** A render-produced image slot; `url` is what the agent fills in before applying. */
const imageSlotSchema = z.object({
  placeholder: z.string().min(1),
  alt: z.string().optional().default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  url: z.string().nullable().optional().default(null),
});

const applyImagesParamsSchema = z.object({
  html: z.string().min(1),
  images: z.array(imageSlotSchema),
});

app.post("/tools/apply_images", requireBearer, (req, res) => {
  try {
    const params = getParams(req.body) as Record<string, unknown>;
    const { html, images } = applyImagesParamsSchema.parse(params);
    const result = applyImages(html, images as ImageSlot[]);
    res.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid apply_images params", details: err.issues });
    }
    console.error("apply_images failed:", err);
    res.status(500).json({ error: "apply_images failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Opal landing-page tool on :${PORT}`);
  console.log(`  GET  /discovery`);
  console.log(`  POST /tools/get_landing_page_spec`);
  console.log(`  POST /tools/render_landing_page`);
  console.log(`  POST /tools/apply_images`);
});

export { app };
