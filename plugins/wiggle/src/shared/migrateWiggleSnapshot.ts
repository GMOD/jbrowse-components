/**
 * Migrates old wiggle snapshot properties to configOverrides.
 *
 * Handles two generations of old property names:
 *
 * Generation 1 (SharedWiggleMixin):
 *   rendererTypeNameState / selectedRendering, scale, autoscale,
 *   summaryScoreMode, constraints.{min,max}, color, posColor, negColor,
 *   showSidebar, fill, minSize
 *
 * Generation 2 (*Setting suffix):
 *   colorSetting, posColorSetting, negColorSetting, scaleTypeSetting,
 *   minScoreSetting, maxScoreSetting, renderingTypeSetting,
 *   summaryScoreModeSetting, autoscaleSetting, showTreeSetting
 *
 * Gen2 takes precedence over Gen1 when both are present.
 *
 * Also handles the old WiggleRenderer `bicolorPivot` (a stringEnum of
 * numeric/mean/z_score/none paired with a separate numeric `bicolorPivotValue`)
 * collapsing into the current numeric `bicolorPivot`. Without this an old
 * `bicolorPivot: 'numeric'` string lands on the new number slot and throws on
 * hydration. mean/z_score/none have no numeric equivalent and fall back to the
 * default.
 */
export function migrateWiggleSnapshot(
  snap: Record<string, unknown>,
  opts?: { multiWiggle?: boolean },
) {
  const {
    rendererTypeNameState,
    selectedRendering,
    scale,
    autoscale: autoscaleGen1,
    summaryScoreMode: summaryScoreModeGen1,
    constraints,
    showSidebar,
    fill,
    color: colorGen1,
    posColor: posColorGen1,
    negColor: negColorGen1,
    minSize,
    colorSetting,
    posColorSetting,
    negColorSetting,
    scaleTypeSetting,
    minScoreSetting,
    maxScoreSetting,
    renderingTypeSetting,
    summaryScoreModeSetting,
    autoscaleSetting,
    showTreeSetting,
    bicolorPivot,
    bicolorPivotValue,
    // clipColor was a WiggleRenderer slot with no display-config equivalent
    clipColor: _clipColor,
    ...rest
  } = snap

  const cons = constraints as { min?: number; max?: number } | undefined

  // Old renderer: bicolorPivot was an enum; 'numeric' meant "use
  // bicolorPivotValue". New config: bicolorPivot is itself the numeric pivot.
  const bicolorPivotNumeric =
    typeof bicolorPivot === 'number'
      ? bicolorPivot
      : bicolorPivot === 'numeric' && typeof bicolorPivotValue === 'number'
        ? bicolorPivotValue
        : undefined
  const oldRendering =
    (rendererTypeNameState as string | undefined) ??
    (selectedRendering as string | undefined)
  const defaultRendering =
    renderingTypeSetting ??
    (oldRendering !== undefined &&
    opts?.multiWiggle &&
    oldRendering === 'xyplot'
      ? 'multixyplot'
      : oldRendering)

  const effectiveColor = colorSetting ?? colorGen1
  // Old sessions used '#f0f'/'#ff00ff' as a sentinel meaning "bicolor mode".
  // Migrate to an explicit useBicolor flag; strip the sentinel from color.
  const isSentinelColor =
    effectiveColor === '#f0f' || effectiveColor === '#ff00ff'

  const candidates: Record<string, unknown> = {
    defaultRendering,
    scaleType: scaleTypeSetting ?? scale,
    autoscale: autoscaleSetting ?? autoscaleGen1,
    summaryScoreMode: summaryScoreModeSetting ?? summaryScoreModeGen1,
    minScore: minScoreSetting ?? cons?.min,
    maxScore: maxScoreSetting ?? cons?.max,
    color: isSentinelColor ? undefined : effectiveColor,
    useBicolor: isSentinelColor ? true : effectiveColor !== undefined ? false : undefined,
    posColor: posColorSetting ?? posColorGen1,
    negColor: negColorSetting ?? negColorGen1,
    showTree: showTreeSetting ?? showSidebar,
    bicolorPivot: bicolorPivotNumeric,
  }

  const overrides: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(candidates)) {
    if (value !== undefined) {
      overrides[key] = value
    }
  }

  if (Object.keys(overrides).length === 0) {
    return rest
  }

  return {
    ...rest,
    configOverrides: {
      ...(rest.configOverrides as Record<string, unknown> | undefined),
      ...overrides,
    },
  }
}
