import { applyRetiredSpellings } from '@jbrowse/core/configuration'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

import { legacyGeneGlyphMode } from './geneGlyphMode.ts'
import {
  SHOW_LABELS_MODES,
  modeCanShowDescription,
  modeCanShowName,
} from './showLabelsMode.ts'

import type { ShowLabelsMode } from './showLabelsMode.ts'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

// A label field written as the bare string its schema's shorthand lifts, as
// the object, so a `showLabels` lift beside it lands next to the field rather
// than under a string it cannot merge with. A display entry gets this from its
// schema; a v4 `renderer` block, lifted by name, does not.
function withLabelFields(props: Record<string, unknown>) {
  const { labels } = props
  if (!isRecord(labels)) {
    return props
  }
  const asPart = (value: unknown) =>
    typeof value === 'string' ? { field: value } : value
  return {
    ...props,
    labels: Object.fromEntries(
      Object.entries(labels).map(([key, value]) => [
        key,
        key === 'name' || key === 'description' ? asPart(value) : value,
      ]),
    ),
  }
}

// A v4 `renderer` block's props become the display's own: `renderer.height`
// was the feature body's height, now `featureHeight`, since lifting it by name
// would set a v4 config's track height to ~10px; a v4 name one level down
// (`renderer: { color1 }`) takes the same retired map; and a prop the display
// has no slot for is dropped by the lift's own rule.
function liftRenderer(renderer: unknown): Record<string, unknown> {
  if (!isRecord(renderer)) {
    return {}
  }
  const {
    type: _rendererType,
    height: rendererHeight,
    ...rendererProps
  } = renderer
  return applyRetiredSpellings(basicRetired, {
    ...withLabelFields(rendererProps),
    ...(rendererHeight !== undefined
      ? { featureHeight: rendererHeight }
      : undefined),
  })
}

// The removed `reducedRepresentation` and `collapse` values map to `normal`
// so old configs pass the narrowed enum.
function normalizeDisplayMode(value: unknown) {
  return value === 'reducedRepresentation' || value === 'collapse'
    ? 'normal'
    : value
}

/**
 * The v4 names whose value moves to one current slot unchanged. Declared rather
 * than folded into the pass below so they are lifted with the retired display
 * types, before the `displayDefaults` shorthand merges into the entry: a
 * `color1` the entry spells has to beat a `color` the shorthand carries, and it
 * cannot while it is still spelt `color1` when the two merge.
 */
export const basicRetired: Record<
  string,
  (value: unknown) => Record<string, unknown>
> = {
  color1: (value: unknown) => ({ encoding: { color: { value } } }),
  // the glyph's lines take the theme's stroke color
  color2: () => ({}),
  color3: (value: unknown) => ({ utrs: { encoding: { color: { value } } } }),
  // v4's per-feature height callback drops; `mark.height` is a number
  featureHeight: (height: unknown) =>
    isJexl(height) ? {} : { mark: { height } },
  transcriptTypes: (types: unknown) => ({ transcripts: { types } }),
  canonicalTranscriptField: (field: unknown) => ({ transcripts: { field } }),
  canonicalTranscriptTags: (sort: unknown) => ({ transcripts: { sort } }),
  containerTypes: (types: unknown) => ({ containers: { types } }),
  // permanent: jb2hubs writes `mouseover`, the one spelling v4 hosts read
  mouseover: (field: unknown) => ({ tooltip: { field } }),
  // v4's boolean, and the five-value enum the hosted demos and figure links
  // still carry; `auto` and `nameAndDescription` were the defaults
  // each writes its show either way, since a settings bag lands on a config
  // that may already hide the label
  showLabels: (value: unknown) => labelsShown(value),
  showDescriptions: (value: unknown) =>
    typeof value === 'boolean'
      ? { labels: { description: { show: value } } }
      : {},
  subfeatureLabels: (mode: unknown) => ({
    labels: {
      subfeatures:
        mode === 'none' ? { show: false } : { show: true, placement: mode },
    },
  }),
  // the feature outline is cut, as ADR-240 cut the pileup's
  outline: () => ({}),
  // a second grow ceiling, dead at its default; `growMaxHeight` is the one
  maxHeight: () => ({}),
  hideSourceFeatures: () => ({}),
  // implied UTRs always draw (ADR-238: one behaviour)
  impliedUTRs: () => ({}),
  renderer: liftRenderer,
}

// v4's boolean switched the names alone; the enum names both
function labelsShown(value: unknown) {
  return typeof value === 'boolean'
    ? { labels: { name: { show: value } } }
    : isShowLabelsMode(value)
      ? {
          labels: {
            name: { show: modeCanShowName(value) },
            description: { show: modeCanShowDescription(value) },
          },
        }
      : {}
}

function isShowLabelsMode(value: unknown): value is ShowLabelsMode {
  return SHOW_LABELS_MODES.includes(value as ShowLabelsMode)
}

export function migrateBasicConfigSnapshot(snap: Record<string, unknown>) {
  const result = { ...snap }
  if (result.geneGlyphMode !== undefined) {
    result.geneGlyphMode = legacyGeneGlyphMode(result.geneGlyphMode)
  }
  if (result.displayMode !== undefined) {
    result.displayMode = normalizeDisplayMode(result.displayMode)
  }
  return result
}
