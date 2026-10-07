import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'

import { hasVisibleText } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { GlyphType } from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

function toLabelString(value: unknown) {
  return valueText(value) || undefined
}

export function getFeatureName(feature: Feature): string | undefined {
  // empty-string name falls back to id
  return toLabelString(feature.get('name')) ?? toLabelString(feature.get('id'))
}

type LabelReader = (feature: Feature) => string | undefined

const noLabel: LabelReader = () => undefined

// An empty field is a label line switched off. An expression that does not
// compile, or that throws on a feature, draws no label rather than failing the
// render. The defaults are jexl, so a plugin-registered function resolves only
// against the worker pluginManager's instance.
function labelReader(ref: string, jexl: JexlInstance | undefined): LabelReader {
  if (!ref) {
    return noLabel
  }
  try {
    const read = fieldReader(ref, jexl)
    return feature => {
      try {
        return toLabelString(read(feature))
      } catch {
        return undefined
      }
    }
  } catch {
    return noLabel
  }
}

interface LabelReaders {
  jexl: JexlInstance | undefined
  name: LabelReader
  description: LabelReader
}

// One pair per config object, which is one per render: the layout pass and the
// collect pass both read labels, off the same config, and neither compiles a
// field per feature.
const readersByConfig = new WeakMap<DisplayConfig, LabelReaders>()

function labelReaders(config: DisplayConfig, jexl: JexlInstance | undefined) {
  const known = readersByConfig.get(config)
  if (known && known.jexl === jexl) {
    return known
  }
  const readers = {
    jexl,
    name: labelReader(config.labels.name, jexl),
    description: labelReader(config.labels.description, jexl),
  }
  readersByConfig.set(config, readers)
  return readers
}

// Subfeature label paths render a single name line, so the description is not
// read for them.
export function readFeatureName(
  config: DisplayConfig,
  feature: Feature,
  jexl: JexlInstance | undefined,
) {
  return labelReaders(config, jexl).name(feature)
}

export function readFeatureLabels(
  config: DisplayConfig,
  feature: Feature,
  jexl: JexlInstance,
): { name: string | undefined; description: string | undefined } {
  const { name, description } = labelReaders(config, jexl)
  return { name: name(feature), description: description(feature) }
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
    hasVisibleText(subfeatureLabelText(feature, config, jexl))
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
  return config.subfeatureLabels === 'below' && labels.some(hasVisibleText)
    ? 1
    : 0
}

/**
 * The text a subfeature's label draws. A subfeature needs a label row only
 * when this text is visible. Both the reservation and the emit go through this, so a track
 * labelling its children by `product` reserves the row it then paints into.
 */
export function subfeatureLabelText(
  feature: Feature,
  config: DisplayConfig,
  jexl: JexlInstance | undefined,
) {
  return readFeatureName(config, feature, jexl) ?? getFeatureName(feature)
}
