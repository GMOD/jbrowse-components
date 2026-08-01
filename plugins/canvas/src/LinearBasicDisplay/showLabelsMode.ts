// Single source of truth for the showLabels display setting: one enum covering
// both which label text is drawn and whether that choice adapts to zoom.
//
// 'auto' picks per zoom, dropping descriptions before names (see
// maxDescriptionFeatureDensity / maxLabelFeatureDensity); the other four pin a
// content choice. Folding content and adaptivity into one enum keeps the track
// menu a single flat radio group — the former split (a three-way radio for
// names plus a separate descriptions checkbox) let 'off' hide names while
// descriptions kept painting, a state nothing in the UI named.
//
// The model resolves this enum into concrete booleans (see baseModel
// `showLabels` / `effectiveShowDescriptions`) for all downstream consumers —
// layout, RPC, SVG export, hit testing — so the enum itself never crosses the
// worker boundary.
export const SHOW_LABELS_MODES = [
  'auto',
  'nameAndDescription',
  'name',
  'description',
  'none',
] as const

export type ShowLabelsMode = (typeof SHOW_LABELS_MODES)[number]

// Whether the mode admits each label kind at all. 'auto' admits both and defers
// to the density thresholds; the model combines these with the density gate,
// collapsed mode, and the fit ladder.
export function modeCanShowName(mode: ShowLabelsMode) {
  return mode === 'auto' || mode === 'nameAndDescription' || mode === 'name'
}

export function modeCanShowDescription(mode: ShowLabelsMode) {
  return (
    mode === 'auto' || mode === 'nameAndDescription' || mode === 'description'
  )
}

// Legacy configs (and renderer sub-configs lifted onto the display) stored
// showLabels as a boolean, then as an 'auto' | 'on' | 'off' enum paired with a
// separate showDescriptions boolean. Fold both onto the unified enum.
// true → 'auto' preserves "labels visible at sparse zooms" while gaining
// density-based hide at zoom-out; false → the descriptions-only or none rung,
// which is what the old pair actually rendered.
export function legacyShowLabelsToMode(
  value: unknown,
  showDescriptions: boolean,
): ShowLabelsMode {
  const withDescriptions = (a: ShowLabelsMode, b: ShowLabelsMode) =>
    showDescriptions ? a : b
  return value === false || value === 'off'
    ? withDescriptions('description', 'none')
    : value === 'on'
      ? withDescriptions('nameAndDescription', 'name')
      : // 'auto' + descriptions off has no home on the unified enum: it wants a
        // density-adaptive name with descriptions never drawn. Land on 'auto'
        // (descriptions return at low density) rather than pinning 'name' and
        // silently forfeiting the density gate.
        'auto'
}
