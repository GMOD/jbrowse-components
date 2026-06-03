import { legacyGeneGlyphMode } from './geneGlyphMode.ts'
import { legacyShowLabelsToMode } from './showLabelsMode.ts'

// The cryptic color1/color2/color3 slots were renamed to the self-describing
// color/connectorColor/utrColor, and `outline` to `outlineColor` (so every
// color slot but the primary `color` ends in `Color`). Map the legacy keys onto
// the new ones; the new name wins if both are present. Used on both the config
// snapshot and inside an old session's configOverrides map.
function renameLegacyColorKeys(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const { color1, color2, color3, outline, ...rest } = obj
  return {
    ...rest,
    ...(color1 !== undefined && rest.color === undefined
      ? { color: color1 }
      : undefined),
    ...(color2 !== undefined && rest.connectorColor === undefined
      ? { connectorColor: color2 }
      : undefined),
    ...(color3 !== undefined && rest.utrColor === undefined
      ? { utrColor: color3 }
      : undefined),
    ...(outline !== undefined && rest.outlineColor === undefined
      ? { outlineColor: outline }
      : undefined),
  }
}

// Back-compat for the display *config* snapshot (vs migrateBasicSnapshot below,
// which handles the display *state model* snapshot). Does three things:
//   - lifts color/label/glyph settings out of the old `renderer` sub-config
//     that the GPU rewrite removed
//   - renames the legacy color1/color2/color3/outline slots to
//     color/connectorColor/utrColor/outlineColor
//   - normalizes legacy enum values that were renamed (boolean showLabels →
//     auto/on/off, geneGlyphMode 'longest' → 'longestCoding') so they pass
//     schema validation on load
export function migrateBasicConfigSnapshot(snap: Record<string, unknown>) {
  const liftedRaw =
    snap.renderer && typeof snap.renderer === 'object'
      ? (() => {
          const { type: _type, ...rendererProps } = snap.renderer as Record<
            string,
            unknown
          >
          const { renderer: _renderer, ...rest } = snap
          return { ...rendererProps, ...rest }
        })()
      : snap
  const lifted = renameLegacyColorKeys(liftedRaw)
  return {
    ...lifted,
    ...(typeof lifted.showLabels === 'boolean'
      ? { showLabels: legacyShowLabelsToMode(lifted.showLabels) }
      : undefined),
    ...(lifted.geneGlyphMode !== undefined
      ? { geneGlyphMode: legacyGeneGlyphMode(lifted.geneGlyphMode) }
      : undefined),
  }
}

// Migrate legacy snapshot shapes: strip removed FeatureDensityMixin fields and
// promote the old per-property `track<Setting>` values into the unified
// configOverrides map. (height/heightPreConfig → heightOverride is handled
// centrally by TrackHeightMixin's migration, so height passes through here.)
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
    userBpPerPxLimit,
    userByteSizeLimit,
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
  const colorVal = color ?? color1
  const connectorVal = connectorColor ?? color2
  const utrVal = utrColor ?? color3
  const outlineVal = outlineColor ?? outline
  if (colorVal !== undefined) {
    migrated.color = colorVal
  }
  if (connectorVal !== undefined) {
    migrated.connectorColor = connectorVal
  }
  if (utrVal !== undefined) {
    migrated.utrColor = utrVal
  }
  if (outlineVal !== undefined) {
    migrated.outlineColor = outlineVal
  }
  if (trackShowLabels !== undefined) {
    migrated.showLabels = legacyShowLabelsToMode(trackShowLabels)
  }
  if (trackShowDescriptions !== undefined) {
    migrated.showDescriptions = trackShowDescriptions
  }
  if (trackSubfeatureLabels !== undefined) {
    migrated.subfeatureLabels = trackSubfeatureLabels
  }
  if (trackGeneGlyphMode !== undefined) {
    migrated.geneGlyphMode = legacyGeneGlyphMode(trackGeneGlyphMode)
  }
  if (trackDisplayMode !== undefined) {
    migrated.displayMode = trackDisplayMode
  }
  if (trackDisplayDirectionalChevrons !== undefined) {
    migrated.displayDirectionalChevrons = trackDisplayDirectionalChevrons
  }

  const existingOverrides =
    typeof rest.configOverrides === 'object' && rest.configOverrides !== null
      ? (rest.configOverrides as Record<string, unknown>)
      : undefined

  // Normalize an old session's override map in place: rename legacy
  // color1/2/3 keys, and convert a boolean showLabels (schema flipped from
  // boolean to the auto/on/off enum) so it passes validation on load.
  const normalizedOverrides = existingOverrides
    ? (() => {
        const renamed = renameLegacyColorKeys(existingOverrides)
        return typeof renamed.showLabels === 'boolean'
          ? {
              ...renamed,
              showLabels: legacyShowLabelsToMode(renamed.showLabels),
            }
          : renamed
      })()
    : undefined

  return {
    ...rest,
    ...((Object.keys(migrated).length > 0 || normalizedOverrides) && {
      configOverrides: { ...normalizedOverrides, ...migrated },
    }),
  }
}
