import { readConfigValueSafe } from './renderConfig.ts'
import { hasVisibleText, truncateLabel } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { GlyphType } from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// A label value may arrive as a multi-valued array — a GFF attribute whose
// value held unescaped commas — so width measurement and truncation downstream
// always see text.
function toLabelString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined
  }
  const text = Array.isArray(value) ? value.join(',') : String(value)
  return text.length > 0 ? text : undefined
}

export function getFeatureName(feature: Feature): string | undefined {
  // empty-string name falls back to id
  return toLabelString(feature.get('name')) ?? toLabelString(feature.get('id'))
}

// The labels.name/labels.description defaults ARE jexl, so a plugin-registered
// jexl function only resolves when the caller passes the worker
// pluginManager's jexl instance.
function readFeatureLabel(
  config: DisplayConfig,
  feature: Feature,
  which: 'name' | 'description',
  jexl: JexlInstance,
) {
  return toLabelString(
    readConfigValueSafe<unknown>(
      config,
      ['labels', which],
      feature,
      jexl,
      undefined,
    ),
  )
}

// Subfeature label paths render a single name line, so evaluating the
// description slot too would waste a jexl eval per feature.
export function readFeatureName(
  config: DisplayConfig,
  feature: Feature,
  jexl: JexlInstance,
) {
  return readFeatureLabel(config, feature, 'name', jexl)
}

export function readFeatureLabels(
  config: DisplayConfig,
  feature: Feature,
  jexl: JexlInstance,
): { name: string | undefined; description: string | undefined } {
  return {
    name: readFeatureLabel(config, feature, 'name', jexl),
    description: readFeatureLabel(config, feature, 'description', jexl),
  }
}

// Does this glyph's emitter register the feature ITSELF as a labeled
// subfeature? The rest label their CHILDREN instead. Exhaustive over GlyphType
// like GLYPH_EMITTERS, so a new glyph is a compile error here until it says
// which it does.
const SELF_LABELING_GLYPHS: Record<GlyphType, boolean> = {
  ProcessedTranscript: true,
  Segments: true,
  Box: true,
  MatureProteinRegion: false,
  RepeatRegion: false,
  CrisprGuide: false,
  Motif: false,
  // never a child of a gene — it IS the gene, and processFeatureRecord draws
  // the feature's own label
  Subfeatures: false,
}

// Answers a BOOLEAN rather than a height. The row's height is the display
// mode's resolved label font size, and the worker stays mode-agnostic so a
// compact toggle never refetches — the main thread spends the row it counts
// here.
export function reservesBelowLabelRow(args: {
  feature: Feature
  config: DisplayConfig
  glyphType: GlyphType
  jexl: JexlInstance | undefined
}) {
  const { feature, config, glyphType, jexl } = args
  return (
    SELF_LABELING_GLYPHS[glyphType] &&
    config.subfeatureLabels === 'below' &&
    hasVisibleText(
      truncateLabel(subfeatureLabelText(feature, config, jexl) ?? ''),
    )
  )
}

/**
 * The `labelRows` a glyph reserves for children that all label into ONE shared
 * row under its body. Those emitters register children straight off the
 * feature, so no child layout owns a row and the containing layout is the only
 * place left to reserve it.
 *
 * Takes the label STRINGS the emitter will draw rather than the child features,
 * because they are not all the child's own name — a CRISPR guide's PAM draws
 * the literal `PAM` off a subfeature carrying no name at all.
 */
export function sharedChildLabelRows(
  config: DisplayConfig,
  labels: (string | undefined)[],
) {
  return config.subfeatureLabels === 'below' &&
    labels.some(label => hasVisibleText(truncateLabel(label ?? '')))
    ? 1
    : 0
}

/**
 * The text a subfeature's own label draws, which is what decides whether it
 * needs a row. Both the reservation and the emit go through this, so a track
 * labelling its children by `product` reserves the row it then paints into.
 */
export function subfeatureLabelText(
  feature: Feature,
  config: DisplayConfig,
  jexl: JexlInstance | undefined,
) {
  return (
    (jexl ? readFeatureName(config, feature, jexl) : undefined) ??
    getFeatureName(feature)
  )
}
