import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'
import {
  boundStackedBands,
  dragBandHeight,
  stackBands,
} from '@jbrowse/core/util/bandLayout'

import type { Band, BandPlot, BandStack } from '@jbrowse/core/util/bandLayout'

export const GENOTYPE_SPLITTER = /[/|]/

// A track's `displays` union probes every member's preprocessor with every
// entry, so a refusal checks the snapshot is this display's before it fires.
export const VARIANT_DISPLAY = 'LinearVariantDisplay'

export const f2 = 0.3

// What one row stands for: a sample, or one of its haplotypes.
export const VARIANT_ROWS_FIELDS = ['sample', 'haplotype'] as const
export type VariantRowsField = (typeof VARIANT_ROWS_FIELDS)[number]

// Feature-detail widget opened when a variant is clicked
export const VARIANT_FEATURE_WIDGET = {
  type: 'VariantFeatureWidget',
  id: 'variantFeature',
}

// A drag's floor, which keeps the seam handle on the band grabbable
const MIN_CONNECTORS_HEIGHT = 10

/**
 * The `connectors` band, the connector lines over the plot they tie to the
 * genome (the genotype rows' columns, the LD triangle), taking its height
 * from that plot: the stated height bound so the plot keeps
 * `MIN_BAND_HEIGHT`.
 */
export function boundConnectorsBand(plotHeight: number, band: Band) {
  return boundStackedBands(
    ['connectors'],
    { connectors: band },
    connectorsPlot(plotHeight),
  ).connectors
}

/**
 * The bound `connectors` band folded alone, the stack its drag is clamped
 * against.
 */
export function connectorsBandStack(band: Band) {
  return stackBands(['connectors'], { connectors: band })
}

function connectorsPlot(plotHeight: number): BandPlot {
  return { height: plotHeight, floor: MIN_BAND_HEIGHT }
}

/**
 * A drag of the `connectors` band folded by {@link connectorsBandStack}: down
 * to the handle's floor and up to where the plot under it keeps its own.
 */
export function dragConnectorsHeight(
  stack: BandStack<'connectors'>,
  plotHeight: number,
  target: number,
) {
  return dragBandHeight(
    stack,
    'connectors',
    connectorsPlot(plotHeight),
    target,
    MIN_CONNECTORS_HEIGHT,
  )
}

// Screen row a worker row maps to when the display isn't drawing it (see
// `rowRemap`). Not a "skip this cell" flag anyone tests for: at this row index
// every painter's own Y-cull already puts the cell millions of pixels below the
// canvas, so the sentinel costs no branch on either backend, in the insertion-
// glyph overlay, or in the SVG export. Chosen to be exactly representable in
// float32 — the GPU paths carry the row index through a `float()` cast.
export const HIDDEN_ROW = 0x00ffffff

// Variant rendering colors. Known clashes, declined 2026-10-23 and re-raised
// only on request: OTHER black matches UNPHASED_COLOR in phased mode colored by
// SV type, and the no-call yellow nears INV orange under deutan and CPX green
// under protan.
export const REFERENCE_COLOR = '#ccc'
// The row-separator hairline's alpha over the theme divider: the cells fill
// their rows edge to edge, so the line needs the same weight the multi-row
// painting gives it
export const SEPARATOR_OPACITY = 0.4
export const MATRIX_CONNECTOR_STROKE_PX = 0.5
export const LD_CONNECTOR_STROKE_PX = 1
export const NO_CALL_COLOR = 'hsl(50,50%,50%)'
export const UNPHASED_COLOR = 'black'

// Phased mode's fill for a haplotype carrying any alt but the site's most
// frequent, which takes the alt hue every mode paints a full dose in
export const SECONDARY_ALT_COLOR = '#e41a1c'

// Pre-packed ABGR for the unphased "black" fill — lets the hot per-cell loop
// skip the colord cache lookup.
export const BLACK_ABGR = 0xff000000

// Sample-metadata keys that are internal row plumbing (identity, haplotype
// index, rendering color/label) rather than user-facing grouping attributes.
// Shared by the "Color by→Samples" attribute list (which offers everything a
// samplesTsv carries *except* these) and the hover tooltip (which shows the
// metadata rows *except* these), so the two can't drift apart.
export const INTERNAL_SOURCE_KEYS = new Set([
  'name',
  'sampleName',
  'HP',
  'sole',
  'baseUri',
  'color',
  'label',
  'rowColor',
  'id',
])

// "population" -> "Population" for metadata-attribute menu/legend labels. Only
// the first character is uppercased (single-word attribute keys), so it is not
// a general title-caser. Re-exported from core so the call sites in this plugin
// keep their short local import.
export { capitalizeFirst } from '@jbrowse/core/util'
