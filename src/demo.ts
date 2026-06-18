import { writeFileSync } from "node:fs";
import { pageConfigSchema, renderPage } from "./factory.js";
import { EXAMPLE_CONFIG } from "./prompt.js";

// 1. Happy path: the worked example.
const good = pageConfigSchema.parse(EXAMPLE_CONFIG);
const { html, warnings } = renderPage(good);
writeFileSync("demo-output.html", html);
console.log("Rendered example →the demo-output.html");
console.log("  bytes:", html.length, "| warnings:", warnings.length);

// 2. Resilience: one valid section + one section with bad props.
const mixed = pageConfigSchema.parse({
  title: "Partial page",
  sections: [
    { type: "hero", props: { headline: "This one is fine" } },
    { type: "featureGrid", props: { features: [{ title: "only one" , body: "x"}] } }, // needs >=2
  ],
});
const r2 = renderPage(mixed);
console.log("\nMixed config warnings (bad section skipped, not fatal):");
for (const w of r2.warnings) console.log("  -", w);
console.log("  still produced bytes:", r2.html.length);
