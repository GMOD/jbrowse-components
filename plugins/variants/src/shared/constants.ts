export const GENOTYPE_SPLITTER = /[/|]/

export const f2 = 0.3

// Feature-detail widget opened when a variant is clicked. Shared by the
// single-track and multi-sample variant displays so the registered widget
// name/id can't drift between them.
export const VARIANT_FEATURE_WIDGET = {
  type: 'VariantFeatureWidget',
  id: 'variantFeature',
}

// Sidebar and label background opacity
export const SIDEBAR_BACKGROUND_OPACITY = 0.8

// Variant rendering colors
export const REFERENCE_COLOR = '#ccc'
export const NO_CALL_COLOR = 'hsl(50,50%,50%)'
export const UNPHASED_COLOR = 'black'

// Pre-packed ABGR for the unphased "black" fill — lets the hot per-cell loop
// skip the colord cache lookup.
export const BLACK_ABGR = 0xff000000

// Allele count mode colors (HSL values)
export const ALT_COLOR_HUE = 200
export const ALT_COLOR_SATURATION = 50
export const OTHER_ALT_COLOR = 'hsl(0,100%,20%)'

// Helper to get alt color based on dosage (0-1). Single source of truth for the
// alt-dosage shade: the cell renderer (getColorAlleleCount) and the legend both
// call this so their blues can't drift.
export function getAltColorForDosage(dosage: number) {
  const lightness = 80 - dosage * 50
  return `hsl(${ALT_COLOR_HUE},${ALT_COLOR_SATURATION}%,${lightness}%)`
}

// Sample-metadata keys that are internal row plumbing (identity, haplotype
// index, rendering color/label) rather than user-facing grouping attributes.
// Shared by the "Color samples by" attribute list (which offers everything a
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

// "population" -> "Population" for metadata-attribute menu/legend labels.
export function titleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
