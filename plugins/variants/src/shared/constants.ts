import { set1 } from '@jbrowse/core/ui/colors'
import { clampBandHeight } from '@jbrowse/core/util/bandHeight'
import { abgrBlue, abgrGreen, abgrRed } from '@jbrowse/core/util/colorBits'

import { getCachedABGR } from './variantWebglUtils.ts'

export const GENOTYPE_SPLITTER = /[/|]/

export const f2 = 0.3

// Feature-detail widget opened when a variant is clicked. Shared by the
// single-track and multi-sample variant displays so the registered widget
// name/id can't drift between them.
export const VARIANT_FEATURE_WIDGET = {
  type: 'VariantFeatureWidget',
  id: 'variantFeature',
}

// Both displays' connector-line zone is drag-resizable, and both clamp the drag
// through the shared band rule (`clampBandHeight`) — the floor keeps the resize
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
// The legend swatches read these same two constants (see
// variantLegend.getGenotypeLegendItems) so cell and key can't drift.
export const PRIMARY_ALT_COLOR = set1[0]!
export const SECONDARY_ALT_COLOR = set1[1]!

// Pre-packed ABGR for the unphased "black" fill — lets the hot per-cell loop
// skip the colord cache lookup.
export const BLACK_ABGR = 0xff000000

// Allele count mode colors (HSL values)
const ALT_COLOR_HUE = 200
const ALT_COLOR_SATURATION = 50
export const OTHER_ALT_COLOR = 'hsl(0,100%,20%)'

// Helper to get alt color based on dosage (0-1). Single source of truth for the
// alt-dosage shade: the cell renderer (getColorAlleleCount) and the legend both
// call this so their blues can't drift.
export function getAltColorForDosage(dosage: number) {
  const lightness = 80 - dosage * 50
  return `hsl(${ALT_COLOR_HUE},${ALT_COLOR_SATURATION}%,${lightness}%)`
}

// How far toward white a zero-dosage insertion marker would be mixed. Kept well
// under 1 because the marker's bp-count label is drawn in white on top of it, so
// paling the bar eats that label's contrast. At this ceiling the default
// #800080 gives a het bar of rgb(156,57,156), which is 6.0:1 against white —
// still clear of WCAG AA's 4.5:1, where a straight lightness ramp to the cells'
// own 80% would be under 2:1 and illegible.
const INSERTION_PALE_MIX = 0.45

/**
 * The insertion marker's fill at a given alt dosage (the 0-255 byte the cells
 * carry): full strength for a hom or haploid alt, paler for a het, so the glyph
 * carries the zygosity its own geometry takes away. A marker is drawn only when
 * it is WIDER than the cell it belongs to (literally `variantCellSpanPx`'s
 * `drawsMarker`), so it covers the dosage-shaded cell underneath completely —
 * before this, every insertion looked homozygous.
 *
 * Mixed toward white with integer math rather than lightened in HSL: the base is
 * a theme value and may be any color, and mixing keeps whatever hue the theme
 * picked. The only parse is `getCachedABGR`, the cache every cell color already
 * goes through; the arithmetic and the string are cheap enough that the draw
 * loop just skips the call when the dosage matches the previous marker.
 *
 * Single source of truth — the marker and its legend swatches both come from
 * here, so the key cannot drift from the glyph.
 */
export function getInsertionColorForDosage(
  insertionColor: string,
  dosageByte: number,
) {
  // full dosage returns the theme string itself, so a hom marker is
  // byte-identical to what the pileup and MAF paint
  if (dosageByte >= 255) {
    return insertionColor
  }
  const base = getCachedABGR(insertionColor)
  const t = ((255 - dosageByte) * INSERTION_PALE_MIX) / 255
  const r = abgrRed(base)
  const g = abgrGreen(base)
  const b = abgrBlue(base)
  return `rgb(${(r + (255 - r) * t) | 0},${(g + (255 - g) * t) | 0},${(b + (255 - b) * t) | 0})`
}

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
