import { retiredFilterState } from '@jbrowse/core/util/jexlFilters'
import {
  RETIRED_ROW_STATE_KEYS,
  liftRetiredRowState,
} from '@jbrowse/display-kit/retiredSettings'
import { basicRetired } from '@jbrowse/plugin-features'

import type { RetiredSpelling } from '@jbrowse/core/configuration'
import type {
  RetiredDisplayState,
  RetiredDisplayType,
} from '@jbrowse/core/pluggableElementTypes'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

// v4's removed presets, as LinearBasicDisplay reads them
function recordsDisplayModeOf(value: unknown) {
  return value === 'reducedRepresentation' || value === 'collapse'
    ? 'normal'
    : value
}

// What a v4 feature-display spelling lifts to on LinearBasicDisplay, re-rooted
// here: the record settings under `records`, `encoding` where it is, and the
// gene glyph's slots (UTRs, transcripts, containers) dropped, since a VCF
// record draws none.
function underRecords(lifted: Record<string, unknown>) {
  const { displayMode, mark, labels, tooltip, encoding } = lifted
  const labelParts = isRecord(labels)
    ? { name: labels.name, description: labels.description }
    : undefined
  const records = {
    ...(displayMode === undefined
      ? {}
      : { displayMode: recordsDisplayModeOf(displayMode) }),
    ...(mark === undefined ? {} : { mark }),
    ...(labelParts === undefined
      ? {}
      : {
          labels: Object.fromEntries(
            Object.entries(labelParts).filter(([, v]) => v !== undefined),
          ),
        }),
    ...(isRecord(tooltip) && tooltip.field !== undefined
      ? { tooltip: { field: tooltip.field } }
      : {}),
  }
  return {
    ...(Object.keys(records).length > 0 ? { records } : {}),
    ...(encoding === undefined ? {} : { encoding }),
  }
}

// v4's feature-display spellings a VCF record has a slot for
const FEATURE_SPELLINGS = [
  'renderer',
  'featureHeight',
  'showLabels',
  'showDescriptions',
  'color1',
  'mouseover',
]

const reRootedFeatureSpellings: Record<string, RetiredSpelling> =
  Object.fromEntries(
    FEATURE_SPELLINGS.flatMap(name => {
      const lift = basicRetired[name]
      return lift ? [[name, (value: unknown) => underRecords(lift(value))]] : []
    }),
  )

/**
 * The config spellings an older release wrote on this display or one it
 * retired. v4's `LinearVariantDisplay` was a feature display: its `renderer`
 * block (`displayMode`, `height`, `color1`, `showLabels`, ...), `mouseover`
 * and `maxFeatureScreenDensity` are the records band's now, through
 * LinearBasicDisplay's own lifts (`basicRetired`), and its `maxHeight`, a
 * second grow ceiling, drops rather than becoming `records.height`. v4's
 * two multi-sample displays spelt the sidebar's tree and labels and the
 * reference-allele paint as booleans, named the row color's attribute
 * `colorBy`, and carried the wiggle scale slots the matrix never read.
 */
export const retiredConfigSpellings: Record<string, RetiredSpelling> = {
  ...reRootedFeatureSpellings,
  maxFeatureScreenDensity: (value: unknown) => ({
    records: { maxFeatureScreenDensity: value },
  }),
  maxHeight: () => ({}),
  renderingMode: (v: unknown) => ({
    unit: v === 'phased' ? 'haplotype' : 'sample',
  }),
  showSidebarLabels: (labels: unknown) => ({ axis: { labels } }),
  showTree: (tree: unknown) => ({ axis: { tree } }),
  showReferenceAlleles: (draw: unknown) => ({
    referenceDrawingMode: draw ? 'draw' : 'skip',
  }),
  colorBy: (field: unknown) =>
    typeof field === 'string' && field ? { rowColor: field } : {},
  autoscale: () => ({}),
  minScore: () => ({}),
  maxScore: () => ({}),
  scaleType: () => ({}),
  inverted: () => ({}),
  numStdDev: () => ({}),
  minimalTicks: () => ({}),
}

/**
 * The display types this one replaced. v4's two multi-sample displays draw
 * here as they drew, the matrix in columns. `LinearMultiSampleVariantDisplay`
 * was this display's name in the v5 betas.
 */
export const retiredTypes: RetiredDisplayType[] = [
  /**
   * @deprecated beta-only, kept while hosted configs (jb2hubs, the demo
   * configs) still write it; goes once they write `LinearVariantDisplay`
   */
  { type: 'LinearMultiSampleVariantDisplay' },
  { type: 'MultiLinearVariantDisplay' },
  {
    type: 'LinearVariantMatrixDisplay',
    migrate: entry => ({ ...entry, variantLayout: 'columns' }),
  },
]

/**
 * A v4 session's display state. A multi-sample layout copied the colorBy
 * palette into its rows, so its colors stay behind and the palette keeps
 * painting them; its `jexlFilters` and `renderingModeSetting` land as the
 * config's own retired spellings, which `retiredConfigSpellings` then lifts.
 * A v4 `LinearVariantDisplay` held its filters as `jexlFiltersSetting`.
 */
export const retiredState: RetiredDisplayState = {
  keys: [
    ...RETIRED_ROW_STATE_KEYS,
    ...retiredFilterState.keys,
    'jexlFilters',
    'renderingModeSetting',
  ],
  lift: instance => ({
    ...liftRetiredRowState(instance, { colors: false }),
    ...retiredFilterState.lift(instance),
    ...(Array.isArray(instance.jexlFilters)
      ? { jexlFilters: instance.jexlFilters }
      : {}),
    ...(typeof instance.renderingModeSetting === 'string'
      ? { renderingMode: instance.renderingModeSetting }
      : {}),
  }),
}
