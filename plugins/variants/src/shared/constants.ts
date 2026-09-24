import { clampBandHeight } from '@jbrowse/core/util/bandHeight'

export const GENOTYPE_SPLITTER = /[/|]/

// A track's `displays` union probes every member's preprocessor with every
// entry, so a refusal checks the snapshot is this display's before it fires.
export const MULTI_SAMPLE_VARIANT_DISPLAY = 'LinearMultiSampleVariantDisplay'

export const f2 = 0.3

// Feature-detail widget opened when a variant is clicked. Shared by the
// single-track and multi-sample variant displays so the registered widget
// name/id can't drift between them.
export const VARIANT_FEATURE_WIDGET = {
  type: 'VariantFeatureWidget',
  id: 'variantFeature',
}

// The connector-line zone is drag-resizable, clamped through the shared band
// rule (`clampBandHeight`) — the floor keeps the resize
// handle, drawn at lineZoneHeight - 4, reachable. A config or snapshot may still
// declare 0 to turn the zone off entirely; only a *drag* comes through here,
// which is also why this is the resize form and takes the current height: a zone
// a config declared below the floor is not snapped up by its first drag.
const LINE_ZONE_BOUNDS = { min: 10, max: 1000 }

export function clampLineZoneHeight(current: number, target: number) {
  return clampBandHeight(current, target, LINE_ZONE_BOUNDS)
}

// Screen row a worker row maps to when the display isn't drawing it (see
// `rowRemap`). Not a "skip this cell" flag anyone tests for: at this row index
// every painter's own Y-cull already puts the cell millions of pixels below the
// canvas, so the sentinel costs no branch on either backend, in the insertion-
// glyph overlay, or in the SVG export. Chosen to be exactly representable in
// float32 — the GPU paths carry the row index through a `float()` cast.
export const HIDDEN_ROW = 0x00ffffff

// Variant rendering colors
export const REFERENCE_COLOR = '#ccc'
// The row-separator hairline's alpha over the theme divider: the cells fill
// their rows edge to edge, so the line needs the same weight the multi-row
// painting gives it
export const SEPARATOR_OPACITY = 0.4
export const NO_CALL_COLOR = 'hsl(50,50%,50%)'
export const UNPHASED_COLOR = 'black'

// Phased-mode alt fills: the primary (most frequent) alt and everything else.
export const PRIMARY_ALT_COLOR = '#377eb8'
export const SECONDARY_ALT_COLOR = '#e41a1c'

// Pre-packed ABGR for the unphased "black" fill — lets the hot per-cell loop
// skip the colord cache lookup.
export const BLACK_ABGR = 0xff000000

// Sample-metadata keys that are internal row plumbing (identity, haplotype
// index, rendering color/label) rather than user-facing grouping attributes.
// Shared by the "Color by...→Samples" attribute list (which offers everything a
// samplesTsv carries *except* these) and the hover tooltip (which shows the
// metadata rows *except* these), so the two can't drift apart.
export const INTERNAL_SOURCE_KEYS = new Set([
  'name',
  'sampleName',
  'HP',
  'baseUri',
  'color',
  'label',
  'labelColor',
  'id',
])

// "population" -> "Population" for metadata-attribute menu/legend labels. Only
// the first character is uppercased (single-word attribute keys), so it is not
// a general title-caser. Re-exported from core so the call sites in this plugin
// keep their short local import.
export { capitalizeFirst } from '@jbrowse/core/util'
