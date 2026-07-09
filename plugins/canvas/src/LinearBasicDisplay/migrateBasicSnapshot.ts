import { legacyGeneGlyphMode } from './geneGlyphMode.ts'
import { legacyShowLabelsToMode } from './showLabelsMode.ts'

// Lift renderer-nested props onto the snap and drop the renderer sub-config.
// Used by migrateBasicConfigSnapshot to handle the pre-GPU-rewrite format
// where style slots lived under an `ArcRenderer`/`SvgFeatureRenderer` key.
function liftRendererProps(
  snap: Record<string, unknown>,
): Record<string, unknown> {
  const { renderer, ...rest } = snap
  if (!renderer || typeof renderer !== 'object') {
    return snap
  }
  const { type: _rendererType, ...rendererProps } = renderer as Record<
    string,
    unknown
  >
  // snap props take priority: spread renderer first, then rest on top.
  return { ...rendererProps, ...rest }
}

// The removed `reducedRepresentation` (always a no-op) and `collapse` (only
// ever decimated labels, never UI-reachable) displayMode values map back to
// `normal` so old configs/sessions still pass the narrowed enum validation.
function normalizeDisplayMode(value: unknown) {
  return value === 'reducedRepresentation' || value === 'collapse'
    ? 'normal'
    : value
}

// color1/color2/color3 → color/connectorColor/utrColor; outline → outlineColor.
// New name wins if both are present.
function renameLegacyColorKeys(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const { color1, color2, color3, outline, ...result } = obj
  const setIfAbsent = (key: string, legacyVal: unknown) => {
    if (result[key] === undefined && legacyVal !== undefined) {
      result[key] = legacyVal
    }
  }
  setIfAbsent('color', color1)
  setIfAbsent('connectorColor', color2)
  setIfAbsent('utrColor', color3)
  setIfAbsent('outlineColor', outline)
  return result
}

// Back-compat for the display *config* snapshot. This is where every legacy
// feature-display setting now lands: v4.3.0 stored colors/labels/glyph mode in
// the config (the `renderer` sub-config), so migrating them here is sufficient.
// (Old per-display-instance track-menu tweaks — `trackShowLabels` etc. — are
// simply ignored on load; they revert to the config value.) Does three things:
//   - lifts color/label/glyph settings out of the old `renderer` sub-config
//     that the GPU rewrite removed
//   - renames the legacy color1/color2/color3/outline slots to
//     color/connectorColor/utrColor/outlineColor
//   - normalizes legacy enum values that were renamed (boolean showLabels →
//     on/off, geneGlyphMode 'longest' → 'longestCoding') so they pass
//     schema validation on load
export function migrateBasicConfigSnapshot(snap: Record<string, unknown>) {
  const result = renameLegacyColorKeys(liftRendererProps(snap))
  if (typeof result.showLabels === 'boolean') {
    result.showLabels = legacyShowLabelsToMode(result.showLabels)
  }
  if (result.geneGlyphMode !== undefined) {
    result.geneGlyphMode = legacyGeneGlyphMode(result.geneGlyphMode)
  }
  if (result.displayMode !== undefined) {
    result.displayMode = normalizeDisplayMode(result.displayMode)
  }
  // The former `autoHeight` boolean slot became the `grow` value of the unified
  // `heightMode` slot; map a legacy true onto it (unless already set) and drop
  // the retired key. (Legacy squeeze was a display-node prop, not a config slot,
  // so it doesn't pass through here.)
  if (result.autoHeight !== undefined) {
    if (result.autoHeight && result.heightMode === undefined) {
      result.heightMode = 'grow'
    }
    delete result.autoHeight
  }
  return result
}
