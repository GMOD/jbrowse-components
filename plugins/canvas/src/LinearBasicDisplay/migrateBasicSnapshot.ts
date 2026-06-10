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

// Back-compat for the display *config* snapshot (vs migrateBasicSnapshot below,
// which handles the display *state model* snapshot). Does three things:
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
  return result
}

// Migrate legacy snapshot shapes: strip removed fields and promote old
// per-property `track<Setting>` values to flat config keys.
// (height/heightPreConfig → heightOverride is handled centrally by
// TrackHeightMixin's migration, so height passes through here.)
export function migrateBasicSnapshot(
  snap: Record<string, unknown> | undefined,
) {
  if (!snap) {
    return snap
  }
  const {
    blockState,
    showLegend,
    showTooltips,
    // userBpPerPxLimit was from FeatureDensityMixin, which canvas no longer
    // composes; strip it so MST doesn't see an unknown property.
    userBpPerPxLimit,
    trackShowLabels,
    trackShowDescriptions,
    trackSubfeatureLabels,
    trackGeneGlyphMode,
    trackDisplayMode,
    trackDisplayDirectionalChevrons,
    // Color set via a state-model snapshot (e.g. a URL `displaySnapshot` or a
    // session) lands here, not on the config schema, so route it into the
    // override map. Accept both the new names and the legacy color1/2/3; new
    // wins.
    color,
    color1,
    color2,
    color3,
    connectorColor,
    utrColor,
    outline,
    outlineColor,
    ...rest
  } = snap

  const migrated: Record<string, unknown> = {}
  const set = (key: string, val: unknown) => {
    if (val !== undefined) {
      migrated[key] = val
    }
  }

  set('color', color ?? color1)
  set('connectorColor', connectorColor ?? color2)
  set('utrColor', utrColor ?? color3)
  set('outlineColor', outlineColor ?? outline)
  // conversion functions must only be called when the value is present
  if (trackShowLabels !== undefined) {
    set('showLabels', legacyShowLabelsToMode(trackShowLabels))
  }
  set('showDescriptions', trackShowDescriptions)
  set('subfeatureLabels', trackSubfeatureLabels)
  if (trackGeneGlyphMode !== undefined) {
    set('geneGlyphMode', legacyGeneGlyphMode(trackGeneGlyphMode))
  }
  set('displayMode', trackDisplayMode)
  set('displayDirectionalChevrons', trackDisplayDirectionalChevrons)

  return { ...rest, ...migrated }
}
