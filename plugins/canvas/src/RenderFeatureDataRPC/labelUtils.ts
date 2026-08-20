import { readConfigValueSafe } from './renderConfig.ts'
import { hasVisibleText, truncateLabel } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { GlyphType } from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// A label value may be a string, a multi-valued array (e.g. a GFF attribute
// whose value contained unescaped commas, parsed into multiple values), or
// absent. Normalize to a single string so downstream width-measurement and
// truncation always operate on text, never an array.
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

// Reads a single config-jexl label slot. The labels.name/labels.description
// defaults ARE jexl, so a plugin-registered jexl function only resolves when
// the worker pluginManager's jexl instance is passed (same contract as the
// `mouseover` slot). Returns undefined for empty/falsy values so callers can
// use simple truthiness.
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

// Config-jexl name only. Subfeature label paths (mature-protein regions, repeat
// subparts) render a single name line, so evaluating the description slot too
// would waste a jexl eval per feature.
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

// Does this glyph's emitter register the feature ITSELF as a labeled subfeature
// (processTranscriptLayout's `!isRoot` branch, and emitBox's)? The rest label
// their CHILDREN instead — a polyprotein's cleavage products, a transposon's
// subparts.
//
// For `MatureProteinRegion` those child rows are counted by the child layout's
// own `labelRows` (layoutMatureProteinRegion sets `ownsLabelRow` per child).
// `RepeatRegion` and `CrisprGuide` do NOT: their emitters register children
// straight off the feature, and neither layout returns a `labelRows` or an
// `ownsLabelRow`, so in `below` mode those labels draw into a row nothing
// reserved. See TODO.md §"Repeat and CRISPR subpart labels draw into an
// unreserved row".
//
// Keyed off the glyph the child actually resolved to, because the emitter is:
// it was keyed off `transcriptTypes` instead, a seven-entry type list that does
// not name `lnc_RNA` or `misc_RNA`, so such an isoform drew a `below` label
// with no row reserved for it and the text lay across the transcript beneath.
//
// Exhaustive over GlyphType, like GLYPH_EMITTERS itself: a new glyph is a
// compile error here until it says whether it labels itself, which is the only
// thing keeping this table and that one from drifting apart silently.
const SELF_LABELING_GLYPHS: Record<GlyphType, boolean> = {
  ProcessedTranscript: true,
  Segments: true,
  Box: true,
  MatureProteinRegion: false,
  RepeatRegion: false,
  CrisprGuide: false,
  Motif: false,
  // never a child of a gene — it IS the gene, and its own label is the
  // feature's, drawn by processFeatureRecord
  Subfeatures: false,
}

// Whether a child inside a gene needs a `below` label row reserved under it —
// i.e. `below` mode is on, the child draws its own label, and it has a name to
// draw. Only the subfeature path reserves height (top-level and overlay labels
// float without reserving); the name is the feature's own name/id, never a
// config-jexl slot, so this pass stays jexl-free.
//
// Answers a BOOLEAN rather than a height, and that is the whole point. The row's
// height is the display mode's resolved label font size, which the worker is
// deliberately mode-agnostic about (so a compact toggle never refetches). No
// constant works either: a reservation that clears the drawn label in every mode
// is `LABEL_FONT_SIZE × max(labelMultiplier / heightMultiplier)` = 2.33×, which
// is 2.33× too much in normal mode. So the row is COUNTED here and SPENT on the
// main thread, where the mode is known (see `labelRowsAbove` on FeatureLayout).
//
// The same base-vs-drawn mismatch on the HORIZONTAL axis (baked `textWidth` at
// LABEL_FONT_SIZE vs the narrower drawn text) is converted at the point of use
// (`renderedTextWidth`) instead — a width is one multiply where it is read,
// while this height folds into a running Y offset every following transcript
// inherits.
export function reservesBelowLabelRow(args: {
  feature: Feature
  config: DisplayConfig
  glyphType: GlyphType
}) {
  const { feature, config, glyphType } = args
  return (
    SELF_LABELING_GLYPHS[glyphType] &&
    config.subfeatureLabels === 'below' &&
    hasVisibleText(truncateLabel(getFeatureName(feature) ?? ''))
  )
}
