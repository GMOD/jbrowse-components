// Migrate legacy snapshot shapes: strip removed FeatureDensityMixin fields,
// lift `height` to `heightPreConfig`, and promote the old per-property
// `track<Setting>` values into the unified configOverrides map.
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
    height,
    trackShowLabels,
    trackShowDescriptions,
    trackSubfeatureLabels,
    trackGeneGlyphMode,
    trackDisplayMode,
    trackDisplayDirectionalChevrons,
    ...rest
  } = snap

  const migrated: Record<string, unknown> = {}
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
    migrated.geneGlyphMode = trackGeneGlyphMode
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

  // showLabels schema flipped from boolean to enum (auto/on/off). Any
  // pre-existing override with a boolean value needs converting in place so
  // it passes schema validation when the snapshot loads.
  const normalizedOverrides = existingOverrides
    ? typeof existingOverrides.showLabels === 'boolean'
      ? {
          ...existingOverrides,
          showLabels: legacyShowLabelsToMode(existingOverrides.showLabels),
        }
      : existingOverrides
    : undefined

  return {
    ...rest,
    ...(height !== undefined && rest.heightPreConfig === undefined
      ? { heightPreConfig: height }
      : undefined),
    ...((Object.keys(migrated).length > 0 || normalizedOverrides) && {
      configOverrides: { ...normalizedOverrides, ...migrated },
    }),
  }
}

// true → 'auto' (new sensible default; preserves "labels visible at sparse
// zooms" while gaining density-based hide at zoom-out). false → 'off'.
function legacyShowLabelsToMode(v: unknown): 'auto' | 'off' {
  return v === false ? 'off' : 'auto'
}
