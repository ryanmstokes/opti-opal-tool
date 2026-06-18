import {
  COMPONENTS,
  COMPONENT_TYPES,
  ITEM_CMS_TYPES,
  type CmsPropDef,
} from "./components.js";

/*
 * Content-type definition generator.
 *
 * buildContentTypeDefinitions() walks the registry's CMS metadata + the
 * experience definition and returns an ORDERED array of cms_create_content_type
 * payloads. Order is a hard CMS requirement (gotcha: every type must exist
 * before anything that references it):
 *   1. item _component types (LpFeature before LpFeatureGrid, etc.)
 *   2. page-level _component types (derived from the registry)
 *   3. the LpExperience _experience type (created last)
 *
 * RISK to log loudly for Phase 7: these are FRESH Lp* types. If the target CMS
 * already has Hero/Testimonial (or similar) blocks, prefer mapping onto those —
 * each component's typeKey is defined in ONE place (its `cms.typeKey` in
 * components.ts / ITEM_CMS_TYPES here), so a remap is a single-line change, not
 * a hunt across files.
 *
 * PROPERTY GROUPS: Optimizely properties can reference a property group. v1 omits
 * groups (optional). If the target instance requires one, add a step to call
 * cms_list_property_groups (or create a group) before creating these types, and
 * stamp a `group` onto each property below.
 *
 * The exact property-type tokens (e.g. "link", "contentReference", the content-
 * area "array"/"content" shape) are conventional here and CONFIRMED in Phase 7
 * against the live model via cms_get_content_type_details.
 */

/** The single-source experience type identity (also used by the payload builder). */
export const EXPERIENCE_TYPE = {
  key: "LpExperience",
  baseType: "_experience" as const,
  metaTitleProp: "MetaTitle",
  metaDescriptionProp: "MetaDescription",
};

export interface CmsPropertyDefinition {
  type: string;
  displayName?: string;
  allowedTypes?: string[];
  items?: { type: string; allowedTypes?: string[] };
}

export interface CmsContentTypeDefinition {
  key: string;
  displayName: string;
  baseType: string;
  compositionBehaviors?: string[];
  properties: Record<string, CmsPropertyDefinition>;
}

/** "LpFeatureGrid" -> "Lp Feature Grid"; "heroImage" -> "Hero Image". */
const titleCase = (s: string): string => {
  const spaced = s.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** Map one registry CMS property to its CMS content-type property definition. */
const toProperty = (p: CmsPropDef): CmsPropertyDefinition => {
  const displayName = titleCase(p.name);
  switch (p.cmsType) {
    case "string":
      return { type: "string", displayName };
    case "richText":
      return { type: "richText", displayName };
    case "boolean":
      return { type: "boolean", displayName };
    case "link":
      return { type: "link", displayName };
    case "contentReference":
      return { type: "contentReference", displayName, allowedTypes: p.allowedTypes ?? [] };
    case "stringList":
      return { type: "array", displayName, items: { type: "string" } };
    case "linkCollection":
      return { type: "array", displayName, items: { type: "link" } };
    case "contentArea":
      return {
        type: "array",
        displayName,
        items: { type: "content", allowedTypes: p.allowedTypes ?? (p.itemType ? [p.itemType] : []) },
      };
  }
};

const propsToObject = (props: CmsPropDef[]): Record<string, CmsPropertyDefinition> => {
  const out: Record<string, CmsPropertyDefinition> = {};
  for (const p of props) out[p.name] = toProperty(p);
  return out;
};

/**
 * The ordered list of content-type definitions to create, components before the
 * experience and item types before their parents.
 */
export const buildContentTypeDefinitions = (): CmsContentTypeDefinition[] => {
  const defs: CmsContentTypeDefinition[] = [];

  // 1. Item _component types (referenced by parents' content areas).
  for (const item of ITEM_CMS_TYPES) {
    defs.push({
      key: item.typeKey,
      displayName: titleCase(item.typeKey),
      baseType: item.baseType,
      properties: propsToObject(item.properties),
    });
  }

  // 2. Page-level _component types, derived from the registry in registry order.
  for (const type of COMPONENT_TYPES) {
    const cms = COMPONENTS[type]!.cms;
    if (!cms) continue;
    defs.push({
      key: cms.typeKey,
      displayName: titleCase(cms.typeKey),
      baseType: cms.baseType ?? "_component",
      ...(cms.compositionBehaviors ? { compositionBehaviors: cms.compositionBehaviors } : {}),
      properties: propsToObject(cms.properties),
    });
  }

  // 3. The experience type, created last.
  defs.push({
    key: EXPERIENCE_TYPE.key,
    displayName: titleCase(EXPERIENCE_TYPE.key),
    baseType: EXPERIENCE_TYPE.baseType,
    properties: {
      [EXPERIENCE_TYPE.metaTitleProp]: { type: "string", displayName: "Meta Title" },
      [EXPERIENCE_TYPE.metaDescriptionProp]: { type: "string", displayName: "Meta Description" },
    },
  });

  return defs;
};

/** Just the keys, in creation order — handy for the endpoint's createOrder. */
export const buildCreateOrder = (): string[] =>
  buildContentTypeDefinitions().map((d) => d.key);
