import { buildContentTypeDefinitions, buildCreateOrder } from "./cmsTypes.js";

/**
 * Phase 3 eyeball script (run: `npm run cms:types`).
 * Prints the ordered content-type definitions and the create order so you can
 * confirm: item types precede their parent components, all components precede
 * the experience, and every property has a valid type.
 */
const defs = buildContentTypeDefinitions();

console.log("=== create order (must be item types → components → experience) ===");
console.log(buildCreateOrder().join("  →  "));

console.log("\n=== definitions ===");
console.log(JSON.stringify(defs, null, 2));

// Lightweight sanity checks so a regression is loud.
const order = defs.map((d) => d.key);
const before = (a: string, b: string) => order.indexOf(a) < order.indexOf(b);
const checks: Array<[boolean, string]> = [
  [before("LpFeature", "LpFeatureGrid"), "LpFeature before LpFeatureGrid"],
  [before("LpPricingTier", "LpPricingTable"), "LpPricingTier before LpPricingTable"],
  [before("LpGalleryImage", "LpGallery"), "LpGalleryImage before LpGallery"],
  [order[order.length - 1] === "LpExperience", "LpExperience is last"],
  [defs.every((d) => Object.keys(d.properties).length > 0), "every type has at least one property"],
];

console.log("\n=== checks ===");
let failed = 0;
for (const [ok, label] of checks) {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`\ncms-types: FAILED (${failed})`);
  process.exit(1);
}
console.log("\ncms-types: ALL PASS");
