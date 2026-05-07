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
    ...rest
  } = snap

  const cons = constraints as { min?: number; max?: number } | undefined
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

  const candidates: Record<string, unknown> = {
    defaultRendering,
    scaleType: scaleTypeSetting ?? scale,
    autoscale: autoscaleSetting ?? autoscaleGen1,
    summaryScoreMode: summaryScoreModeSetting ?? summaryScoreModeGen1,
    minScore: minScoreSetting ?? cons?.min,
    maxScore: maxScoreSetting ?? cons?.max,
    color: colorSetting ?? colorGen1,
    posColor: posColorSetting ?? posColorGen1,
    negColor: negColorSetting ?? negColorGen1,
    showTree: showTreeSetting ?? showSidebar,
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
