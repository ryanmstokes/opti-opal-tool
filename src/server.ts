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
import { buildContentTypeDefinitions, buildCreateOrder } from "./cmsTypes.js";
import { buildExperiencePayload } from "./cmsPayload.js";

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
      {
        name: "get_cms_content_types",
        description:
          "ONE-TIME SETUP for the CMS path. Returns the ordered Optimizely CMS content-type definitions (Lp* _component types and the LpExperience type) derived from the component library, plus the exact create order. Use this when the user wants the landing page as EDITABLE CMS content (Visual Builder) rather than just HTML. Pass each definition to the cms_create_content_type system tool IN ORDER — item/component types before the experience — then build the page config and call build_cms_experience. You only need to run this once per CMS instance.",
        endpoint: "/tools/get_cms_content_types",
        http_method: "POST",
        parameters: [],
      },
      {
        name: "build_cms_experience",
        description:
          "Turns a landing page config into the exact cms_update_content_item payload for an editable Optimizely Experience (its Visual Builder composition holds one editable component per section). Use this AFTER the content types exist (see get_cms_content_types) when the user wants the page as CMS content. Returns { upsert, warnings, instructions }: pass `upsert` to cms_update_content_item, then cms_publish_content_item. Do NOT stringify Properties yourself and do NOT edit the composition — it is already correctly serialized.",
        endpoint: "/tools/build_cms_experience",
        http_method: "POST",
        parameters: [
          {
            name: "config",
            type: "object",
            description:
              "The page config (same shape as render_landing_page). See get_landing_page_spec.",
            required: true,
          },
          {
            name: "routeSegment",
            type: "string",
            description: "URL segment for the page, e.g. \"tracepoint\".",
            required: true,
          },
          {
            name: "locale",
            type: "string",
            description:
              "Locale code from the CMS's enabledLocales. Defaults to \"en\". Do not invent codes.",
            required: false,
          },
          {
            name: "container",
            type: "string",
            description:
              "Optional parent container reference/GUID where the experience is created.",
            required: false,
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

/* ------------------------------- tool 4 ----------------------------------- */

app.post("/tools/get_cms_content_types", requireBearer, (_req, res) => {
  res.json({
    definitions: buildContentTypeDefinitions(),
    createOrder: buildCreateOrder(),
    instructions:
      "One-time setup. Pass each item in `definitions` to the cms_create_content_type system tool in the exact order given by `createOrder` — all _component item and section types MUST exist before the LpExperience that references them. Confirm each with cms_list_content_types. Properties must be passed as real JSON objects (never stringified). If your CMS requires property groups, create/list them first (cms_list_property_groups) and add the group to each property.",
  });
});

/* ------------------------------- tool 5 ----------------------------------- */

const buildCmsExperienceParamsSchema = z.object({
  config: pageConfigSchema,
  routeSegment: z.string().min(1),
  locale: z.string().min(1).default("en"),
  container: z.string().min(1).optional(),
});

app.post("/tools/build_cms_experience", requireBearer, (req, res) => {
  try {
    const params = getParams(req.body) as Record<string, unknown>;
    const { config, routeSegment, locale, container } =
      buildCmsExperienceParamsSchema.parse(params);
    const { upsert, warnings } = buildExperiencePayload(config, {
      locale,
      routeSegment,
      container,
    });
    res.json({
      upsert,
      warnings,
      instructions:
        "Pass `upsert` verbatim to the cms_update_content_item system tool to create/update the experience, then call cms_publish_content_item on the returned contentKey + version. Do NOT stringify Properties (composition is already the one serialized field). For each image warning, upload the asset with cms_upload_media and set the returned cms://content/{key} on the matching contentReference, or leave it for an editor. After writing, re-read with cms_get_content_data to confirm it applied (the CMS can accept-then-ignore silently).",
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid build_cms_experience params", details: err.issues });
    }
    console.error("build_cms_experience failed:", err);
    res.status(500).json({ error: "build_cms_experience failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Opal landing-page tool on :${PORT}`);
  console.log(`  GET  /discovery`);
  console.log(`  POST /tools/get_landing_page_spec`);
  console.log(`  POST /tools/render_landing_page`);
  console.log(`  POST /tools/apply_images`);
  console.log(`  POST /tools/get_cms_content_types`);
  console.log(`  POST /tools/build_cms_experience`);
});

export { app };
