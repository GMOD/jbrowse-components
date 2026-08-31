import { legacyGeneGlyphMode } from './geneGlyphMode.ts'
import { legacyShowLabelsToMode } from './showLabelsMode.ts'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

// Lift renderer-nested props onto the snap and drop the renderer sub-config.
// Used by migrateBasicConfigSnapshot to handle the pre-GPU-rewrite format
// where style slots lived under an `ArcRenderer`/`SvgFeatureRenderer` key.
function liftRendererProps(
  snap: Record<string, unknown>,
): Record<string, unknown> {
  const { renderer, ...rest } = snap
  if (!isRecord(renderer)) {
    // rest already excludes `renderer`, so returning it also drops a stray
    // renderer:null rather than carrying the unknown key into the snapshot.
    return rest
  }
  const {
    type: _rendererType,
    height: rendererHeight,
    ...rendererProps
  } = renderer
  // `renderer.height` was the feature body's height, which is `featureHeight`
  // now — the display's own `height` slot is the whole track. Lifting it by
  // name would set a v4 config's track height to ~10px and quietly revert its
  // feature height to the default. Same mapping as liftLegacyRendererConfig,
  // which used to be the only one that made it.
  // snap props take priority: spread renderer first, then rest on top.
  return {
    ...rendererProps,
    ...(rendererHeight !== undefined
      ? { featureHeight: rendererHeight }
      : undefined),
    ...rest,
  }
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
  // showLabels absorbed the retired showDescriptions boolean, so a config
  // carrying either legacy shape — the original boolean, or the 'auto'/'on'/
  // 'off' enum alongside showDescriptions — folds onto the unified enum here.
  // Only the legacy values need folding: the new enum's own values pass
  // through, so a re-saved config isn't rewritten.
  if (
    result.showDescriptions !== undefined ||
    typeof result.showLabels === 'boolean' ||
    result.showLabels === 'on' ||
    result.showLabels === 'off'
  ) {
    result.showLabels = legacyShowLabelsToMode(
      result.showLabels,
      result.showDescriptions !== false,
    )
    delete result.showDescriptions
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
  // The retired `maxHeight` slot (a second grow ceiling, dead at its default —
  // growMaxHeight is the one grow clamp now). Also arrives via liftRendererProps
  // from the old renderer's layout-bound slot of the same name.
  delete result.maxHeight
  return result
}
