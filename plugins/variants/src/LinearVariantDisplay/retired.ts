import { retiredFilterState } from '@jbrowse/core/util/jexlFilters'
import {
  RETIRED_ROW_STATE_KEYS,
  liftRetiredRowState,
} from '@jbrowse/display-kit/retiredSettings'
import { basicRetired } from '@jbrowse/plugin-features'
import { renameNewickLeaves } from '@jbrowse/tree-sidebar'

import { haplotypeRowName } from '../shared/getSources.ts'

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
 * reference-allele paint as booleans, the latter later a `'draw' | 'skip'`
 * `referenceDrawingMode`, named the row color's attribute
 * `colorBy`, and carried the wiggle scale slots the matrix never read.
 */
export const retiredConfigSpellings: Record<string, RetiredSpelling> = {
  ...reRootedFeatureSpellings,
  maxFeatureScreenDensity: (value: unknown) => ({
    records: { maxFeatureScreenDensity: value },
  }),
  maxHeight: () => ({}),
  renderingMode: (v: unknown) => ({
    rows: { field: v === 'phased' ? 'haplotype' : 'sample' },
  }),
  showSidebarLabels: (labels: unknown) => ({ rows: { axis: { labels } } }),
  showTree: (tree: unknown) => ({ rows: { axis: { tree } } }),
  showReferenceAlleles: (show: unknown) => ({
    genotypes: { reference: { show: !!show } },
  }),
  referenceDrawingMode: (mode: unknown) => ({
    genotypes: { reference: { show: mode === 'draw' } },
  }),
  colorBy: (field: unknown) =>
    typeof field === 'string' && field ? { rows: { color: field } } : {},
  autoscale: () => ({}),
  minScore: () => ({}),
  maxScore: () => ({}),
  scaleType: () => ({}),
  inverted: () => ({}),
  numStdDev: () => ({}),
  minimalTicks: () => ({}),
}

// v4 named a phased row `<sample> HP<i>` counting from 0; its layout rows carry
// the sample as `baseName` and the index as `HP`, which name the row now
function v4HaplotypeNames(layout: unknown) {
  const renamed = new Map<string, string>()
  for (const row of Array.isArray(layout) ? layout : []) {
    if (
      isRecord(row) &&
      typeof row.name === 'string' &&
      typeof row.baseName === 'string' &&
      typeof row.HP === 'number'
    ) {
      renamed.set(row.name, haplotypeRowName(row.baseName, row.HP))
    }
  }
  return renamed
}

// A v4 phased session's layout, tree and subtree filter, naming its
// haplotype rows as this release does
function withHaplotypesFromOne(instance: Record<string, unknown>) {
  const renamed = v4HaplotypeNames(instance.layout)
  const rename = (name: string) => renamed.get(name) ?? name
  const renameValue = (value: unknown) =>
    typeof value === 'string' ? rename(value) : value
  const { layout, clusterTree, subtreeFilter } = instance
  return renamed.size > 0
    ? {
        ...instance,
        layout: (Array.isArray(layout) ? layout : []).map(row =>
          isRecord(row)
            ? {
                ...row,
                name: renameValue(row.name),
                ...(row.label === row.name
                  ? { label: renameValue(row.label) }
                  : {}),
              }
            : row,
        ),
        ...(typeof clusterTree === 'string'
          ? { clusterTree: renameNewickLeaves(clusterTree, rename) }
          : {}),
        ...(Array.isArray(subtreeFilter)
          ? { subtreeFilter: subtreeFilter.map(renameValue) }
          : {}),
      }
    : instance
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
 * The menus' MAF floor and reference-allele toggle land the same way. A v4
 * `LinearVariantDisplay` held its filters as `jexlFiltersSetting`, and a v4
 * matrix its dragged connector band as `lineZoneHeight`. A pixel
 * `rowHeightMode` is `rows.step`; its `'auto'` is the default fit.
 */
export const retiredState: RetiredDisplayState = {
  keys: [
    ...RETIRED_ROW_STATE_KEYS,
    ...retiredFilterState.keys,
    'jexlFilters',
    'renderingModeSetting',
    'lineZoneHeight',
    'minorAlleleFrequencyFilterSetting',
    'referenceDrawingModeSetting',
    'rowHeightMode',
  ],
  lift: instance => {
    const { rows, ...lifted } = liftRetiredRowState(
      withHaplotypesFromOne(instance),
      { colors: false },
    )
    const step =
      typeof instance.rowHeightMode === 'number'
        ? { step: instance.rowHeightMode }
        : {}
    const rowsSetting = { ...(isRecord(rows) ? rows : {}), ...step }
    return {
      ...lifted,
      ...(Object.keys(rowsSetting).length > 0 ? { rows: rowsSetting } : {}),
      ...retiredFilterState.lift(instance),
      ...(Array.isArray(instance.jexlFilters)
        ? { jexlFilters: instance.jexlFilters }
        : {}),
      ...(typeof instance.renderingModeSetting === 'string'
        ? { renderingMode: instance.renderingModeSetting }
        : {}),
      ...(typeof instance.lineZoneHeight === 'number'
        ? { connectors: { height: instance.lineZoneHeight } }
        : {}),
      ...(typeof instance.minorAlleleFrequencyFilterSetting === 'number'
        ? {
            minorAlleleFrequencyFilter:
              instance.minorAlleleFrequencyFilterSetting,
          }
        : {}),
      ...(typeof instance.referenceDrawingModeSetting === 'string'
        ? { referenceDrawingMode: instance.referenceDrawingModeSetting }
        : {}),
    }
  },
}
