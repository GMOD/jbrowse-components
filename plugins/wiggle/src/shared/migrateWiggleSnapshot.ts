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
 */
export function migrateWiggleSnapshot(
  snap: Record<string, unknown>,
  opts?: { multiWiggle?: boolean },
) {
  const {
    // Generation 1 properties
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
    // Generation 2 properties
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

  const overrides: Record<string, unknown> = {}

  // Generation 1 migrations
  const oldRendering =
    (rendererTypeNameState as string | undefined) ??
    (selectedRendering as string | undefined)
  if (oldRendering !== undefined) {
    overrides.defaultRendering =
      opts?.multiWiggle && oldRendering === 'xyplot'
        ? 'multixyplot'
        : oldRendering
  }
  const cons = constraints as { min?: number; max?: number } | undefined
  if (scale !== undefined) {
    overrides.scaleType = scale
  }
  if (autoscaleGen1 !== undefined) {
    overrides.autoscale = autoscaleGen1
  }
  if (summaryScoreModeGen1 !== undefined) {
    overrides.summaryScoreMode = summaryScoreModeGen1
  }
  if (cons?.min !== undefined) {
    overrides.minScore = cons.min
  }
  if (cons?.max !== undefined) {
    overrides.maxScore = cons.max
  }
  if (colorGen1 !== undefined) {
    overrides.color = colorGen1
  }
  if (posColorGen1 !== undefined) {
    overrides.posColor = posColorGen1
  }
  if (negColorGen1 !== undefined) {
    overrides.negColor = negColorGen1
  }
  if (showSidebar !== undefined) {
    overrides.showTree = showSidebar
  }

  // Generation 2 migrations
  if (colorSetting !== undefined) {
    overrides.color = colorSetting
  }
  if (posColorSetting !== undefined) {
    overrides.posColor = posColorSetting
  }
  if (negColorSetting !== undefined) {
    overrides.negColor = negColorSetting
  }
  if (scaleTypeSetting !== undefined) {
    overrides.scaleType = scaleTypeSetting
  }
  if (minScoreSetting !== undefined) {
    overrides.minScore = minScoreSetting
  }
  if (maxScoreSetting !== undefined) {
    overrides.maxScore = maxScoreSetting
  }
  if (renderingTypeSetting !== undefined) {
    overrides.defaultRendering = renderingTypeSetting
  }
  if (summaryScoreModeSetting !== undefined) {
    overrides.summaryScoreMode = summaryScoreModeSetting
  }
  if (autoscaleSetting !== undefined) {
    overrides.autoscale = autoscaleSetting
  }
  if (showTreeSetting !== undefined) {
    overrides.showTree = showTreeSetting
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
