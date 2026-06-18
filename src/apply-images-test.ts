import { pageConfigSchema, renderPage } from "./factory.js";
import { applyImages } from "./html.js";

/**
 * Phase 1a-PRE round-trip test (run: `npm run test:images`).
 * Proves: renderPage surfaces every placeholder as an ImageSlot (url:null),
 * apply_images swaps filled urls deterministically, and the result is
 * byte-identical to the rendered html everywhere except the placeholder spots.
 */
let failures = 0;
const assert = (cond: boolean, msg: string) => {
  if (cond) {
    console.log("  ✓", msg);
  } else {
    console.error("  ✗", msg);
    failures++;
  }
};

const config = pageConfigSchema.parse({
  title: "Image round-trip test",
  sections: [
    { type: "hero", props: { headline: "Headline", imageAlt: "a red bicycle on a sunlit beach", ctas: [] } },
    { type: "featureGrid", props: { features: [{ title: "A", body: "x" }, { title: "B", body: "y" }] } },
  ],
});

const { html, images, warnings } = renderPage(config);

assert(warnings.length === 0, "renders with no warnings");
assert(images.length >= 1, `images lists at least one placeholder (got ${images.length})`);

for (const slot of images) {
  assert(slot.url === null, `slot ${slot.placeholder} starts with url:null`);
  assert(html.includes(slot.placeholder), `placeholder ${slot.placeholder} is present in html`);
  assert(slot.width > 0 && slot.height > 0, `slot ${slot.placeholder} has positive WxH`);
}

const hero = images.find((s) => s.width === 1200 && s.height === 600);
assert(!!hero, "hero slot is 1200x600");
assert(hero?.alt === "a red bicycle on a sunlit beach", "hero alt round-trips un-escaped");

// Fill every url and apply.
const filled = images.map((s, i) => ({ ...s, url: `https://cdn.example.com/img-${i}.png` }));
const applied = applyImages(html, filled);
assert(!applied.html.includes("{{IMAGE:"), "no {{IMAGE: placeholders remain after apply");
assert(applied.warnings.length === 0, "no warnings when all urls filled");

// Byte-identical except at placeholder spots: replacing the urls back to their
// placeholders must reconstruct the original html exactly.
let restored = applied.html;
for (const s of filled) restored = restored.split(s.url).join(s.placeholder);
assert(restored === html, "html is byte-identical except at placeholder spots");

// An unresolved (null) url is kept in place and reported.
const partial = applyImages(
  html,
  images.map((s, i) => (i === 0 ? { ...s, url: null } : { ...s, url: "https://x/y.png" }))
);
const firstPlaceholder = images[0]?.placeholder ?? "";
assert(partial.warnings.length >= 1, "unresolved url produces a warning");
assert(partial.html.includes(firstPlaceholder), "unresolved placeholder kept in place");

if (failures) {
  console.error(`\napply-images round-trip: FAILED (${failures} assertion(s))`);
  process.exit(1);
}
console.log("\napply-images round-trip: ALL PASS");
