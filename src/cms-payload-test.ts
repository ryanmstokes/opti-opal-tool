import { pageConfigSchema } from "./factory.js";
import { EXAMPLE_CONFIG } from "./prompt.js";
import { buildExperiencePayload } from "./cmsPayload.js";
import {
  assertNoStringifiedObjects,
  assertCompositionIsString,
  assertNoDamRefs,
  assertNoNodeIds,
  assertContentAreaItems,
  link,
  contentRef,
} from "./cmsHelpers.js";

/**
 * Phase 4 unit test (run: `npm run test:cms`). Proves the experience payload
 * obeys the section-4 gotchas, and that the guards fail loudly on violations.
 */
let failures = 0;
const assert = (cond: boolean, msg: string) => {
  if (cond) console.log("  ✓", msg);
  else {
    console.error("  ✗", msg);
    failures++;
  }
};
const throws = (fn: () => void, msg: string) => {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, msg);
};

const config = pageConfigSchema.parse(EXAMPLE_CONFIG);
const { upsert, warnings } = buildExperiencePayload(config, {
  locale: "en",
  routeSegment: "tracepoint",
});

const props = upsert.Properties as Record<string, unknown>;

// Shape of the upsert.
assert(upsert.ContentType === "LpExperience", "ContentType is LpExperience");
assert(upsert.DisplayName === config.title, "DisplayName is the page title");
assert(upsert.Locale === "en", "Locale passed through");
assert(upsert.RouteSegment === "tracepoint", "RouteSegment passed through");
assert(!("Container" in upsert), "Container omitted when not provided");

// gotcha #3: composition is a STRING.
assert(typeof props.composition === "string", "Properties.composition is a serialized string");

// Parse it and check the structure.
const composition = JSON.parse(props.composition as string);
assert(composition.nodeType === "experience", 'composition root nodeType is "experience"');
assert(composition.layoutType === "outline", 'composition root layoutType is "outline"');
assert(Array.isArray(composition.nodes), "composition.nodes is an array");

const expectedOrder = [
  "LpNavbar", "LpHero", "LpLogoStrip", "LpStats", "LpFeatureGrid",
  "LpTestimonial", "LpPricingTable", "LpFaq", "LpContactForm", "LpCtaBanner",
];
assert(composition.nodes.length === expectedOrder.length, `composition has ${expectedOrder.length} component nodes (got ${composition.nodes.length})`);
const actualOrder = composition.nodes.map((n: any) => n.component?.contentType);
assert(JSON.stringify(actualOrder) === JSON.stringify(expectedOrder), "nodes are in section order with correct contentTypes");

// Every node has the required shape and NO id (gotcha #5 / #6).
const goodShape = composition.nodes.every(
  (n: any) => n.nodeType === "component" && n.component && n.component.contentType && n.component.properties && !("id" in n)
);
assert(goodShape, "every node is { displayName, nodeType:'component', component:{contentType, properties} } with no id");

// gotcha #1: links are OBJECTS; gotcha #8: no dam refs; no contentReference is an object.
const hero = composition.nodes.find((n: any) => n.component.contentType === "LpHero");
assert(hero?.component.properties.primaryCta?.url === "/signup", "hero primaryCta is a Link object with a url");
const serialized = props.composition as string;
assert(!serialized.includes("cms://content/dam/"), "no cms://content/dam/ anywhere in composition");

// Content area shape (gotcha #7): array of { contentType, content }.
const featureGrid = composition.nodes.find((n: any) => n.component.contentType === "LpFeatureGrid");
const features = featureGrid?.component.properties.features;
assert(Array.isArray(features) && features.length === 6, "LpFeatureGrid.features is an array of 6 items");
assert(
  features.every((f: any) => f.contentType === "LpFeature" && f.content && !("reference" in f) && !("name" in f) && !("typeIdentifier" in f)),
  "each feature is { contentType, content } with no extra fields"
);

// Image warnings: hero (1) + logoStrip (5) + featureGrid icons (3) = 9 described images.
const imageWarnings = warnings.filter((w) => w.includes("is unset"));
assert(imageWarnings.length === 9, `9 image-unset warnings emitted (got ${imageWarnings.length})`);

// Guards must fail loudly on violations.
throws(() => assertNoStringifiedObjects({ Properties: { x: JSON.stringify({ a: 1 }) } }), "assertNoStringifiedObjects throws on a stringified object");
throws(() => assertCompositionIsString({ nodeType: "experience" }), "assertCompositionIsString throws on a non-string");
throws(() => assertNoDamRefs({ img: "cms://content/dam/abc123" }), "assertNoDamRefs throws on a dam ref");
throws(() => assertNoNodeIds([{ id: "x", nodeType: "component" }]), "assertNoNodeIds throws on a node with an id");
throws(
  () => assertContentAreaItems([{ contentType: "LpFeature", content: {}, name: "extra" }]),
  "assertContentAreaItems throws on a content-area item with extra fields"
);
// A valid {contentType, content} item and the node's component object must NOT throw.
assertContentAreaItems(composition);
assert(true, "assertContentAreaItems passes on the real composition (no false positive on node.component)");

// Helper sanity.
assert(JSON.stringify(link("Go", "/x")) === JSON.stringify({ url: "/x", title: "Go" }), "link() builds a {url,title} object");
assert(contentRef("1a2b-3c4d-5e6f") === "cms://content/1a2b3c4d5e6f", "contentRef() strips hyphens and prefixes cms://content/");

if (failures) {
  console.error(`\ncms-payload: FAILED (${failures})`);
  process.exit(1);
}
console.log("\ncms-payload: ALL PASS");
