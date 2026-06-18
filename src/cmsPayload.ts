import { COMPONENTS } from "./components.js";
import { type PageConfig } from "./factory.js";
import { EXPERIENCE_TYPE } from "./cmsTypes.js";
import {
  assertNoStringifiedObjects,
  assertCompositionIsString,
  assertNoDamRefs,
  assertNoNodeIds,
} from "./cmsHelpers.js";

/*
 * Config → experience payload builder.
 *
 * Turns a validated PageConfig into the exact cms_update_content_item upsert for
 * an LpExperience whose Visual Builder composition holds one component node per
 * section. Everything is a real JSON object EXCEPT Properties.composition, which
 * is a serialized JSON STRING (the tool framework corrupts nested node arrays
 * otherwise — gotcha #3). The gotcha guards run before emit so a regression
 * fails loudly rather than silently no-op-ing against the CMS.
 */

export interface BuildExperienceOpts {
  /** Must be one of the CMS instance's enabledLocales (validated in Phase 7). */
  locale: string;
  /** URL segment for the page, e.g. "tracepoint". */
  routeSegment: string;
  /** Optional parent container GUID/reference (Phase-7 instance fact). */
  container?: string;
}

export interface ExperiencePayload {
  upsert: Record<string, unknown>;
  warnings: string[];
}

/** Recursively collect every imageAlt string in a section's props (any nesting). */
const collectImageAlts = (value: unknown, acc: string[]): void => {
  if (Array.isArray(value)) {
    value.forEach((v) => collectImageAlts(v, acc));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "imageAlt" && typeof v === "string") acc.push(v);
      else collectImageAlts(v, acc);
    }
  }
};

export const buildExperiencePayload = (
  config: PageConfig,
  opts: BuildExperienceOpts
): ExperiencePayload => {
  const warnings: string[] = [];
  const nodes: Array<Record<string, unknown>> = [];

  config.sections.forEach((section, i) => {
    const comp = COMPONENTS[section.type];
    if (!comp) {
      warnings.push(`section[${i}]: unknown component "${section.type}" (skipped)`);
      return;
    }
    if (!comp.cms) {
      warnings.push(`section[${i}] (${section.type}): no CMS mapping (skipped)`);
      return;
    }
    // gotcha #5: only sectionEnabled components may sit directly in the outline.
    if (!(comp.cms.compositionBehaviors ?? []).includes("sectionEnabled")) {
      warnings.push(
        `section[${i}] (${comp.cms.typeKey}): not sectionEnabled — would need a Section>Row>Column wrapper (skipped in v1)`
      );
      return;
    }
    // Validate props against the component schema before mapping to CMS values.
    const parsed = comp.schema.safeParse(section.props);
    if (!parsed.success) {
      warnings.push(
        `section[${i}] (${section.type}): invalid props — ${parsed.error.issues
          .map((x) => `${x.path.join(".")}: ${x.message}`)
          .join("; ")} (skipped)`
      );
      return;
    }

    // gotcha #5 node shape — NO id (gotcha #6), properties are a real object.
    nodes.push({
      displayName: comp.cms.typeKey,
      nodeType: "component",
      component: {
        contentType: comp.cms.typeKey,
        properties: comp.cms.mapProps(parsed.data),
      },
    });

    // v1 leaves image references unset; warn per described image so the agent
    // can resolve them via cms_upload_media or the editor.
    const alts: string[] = [];
    collectImageAlts(parsed.data, alts);
    for (const alt of alts) {
      warnings.push(
        `section[${i}] (${comp.cms.typeKey}): image "${alt}" is unset — upload via cms_upload_media and set the contentReference, or fill it in the Visual Builder.`
      );
    }
  });

  // gotcha #4: root MUST have nodeType "experience" + layoutType "outline".
  const composition = {
    displayName: config.title,
    nodeType: "experience",
    layoutType: "outline",
    nodes,
  };

  // Run guards on the OBJECT tree before stringifying.
  assertNoStringifiedObjects(composition, "$.composition");
  assertNoDamRefs(composition, "$.composition");
  assertNoNodeIds(composition.nodes, "$.composition.nodes");

  // gotcha #3: composition leaves as a serialized string — and ONLY composition.
  const compositionString = JSON.stringify(composition);
  assertCompositionIsString(compositionString);

  const Properties: Record<string, unknown> = {
    [EXPERIENCE_TYPE.metaTitleProp]: config.title,
    [EXPERIENCE_TYPE.metaDescriptionProp]: config.description ?? "",
    composition: compositionString,
  };

  // gotcha #2: every Properties value is a real object — except the one we just
  // intentionally stringified (composition), which we skip.
  assertNoStringifiedObjects(Properties, "$.Properties", ["composition"]);

  const upsert: Record<string, unknown> = {
    ContentType: EXPERIENCE_TYPE.key,
    DisplayName: config.title,
    Locale: opts.locale,
    RouteSegment: opts.routeSegment,
    ...(opts.container ? { Container: opts.container } : {}),
    Properties,
  };

  return { upsert, warnings };
};
