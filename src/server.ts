import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { ZodError } from "zod";
import { pageConfigSchema, buildManifest, renderPage } from "./factory.js";
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
          "Renders a landing page config into a complete, styled, self-contained HTML document. Images are emitted as {{IMAGE:WxH:slug}} placeholders to be replaced with real assets later. Returns html plus any per-section validation warnings.",
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
    const { html, warnings } = renderPage(config);
    res.json({ html, warnings, character_count: html.length });
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

app.listen(PORT, () => {
  console.log(`Opal landing-page tool on :${PORT}`);
  console.log(`  GET  /discovery`);
  console.log(`  POST /tools/get_landing_page_spec`);
  console.log(`  POST /tools/render_landing_page`);
});

export { app };
