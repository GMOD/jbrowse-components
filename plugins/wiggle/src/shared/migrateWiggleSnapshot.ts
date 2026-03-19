/**
 * Migrates old SharedWiggleMixin snapshot properties to the new names.
 *
 * Old (origin/main SharedWiggleMixin) → New:
 *   rendererTypeNameState / selectedRendering → renderingTypeSetting
 *   scale → scaleTypeSetting
 *   autoscale → autoscaleSetting
 *   summaryScoreMode → summaryScoreModeSetting
 *   constraints.{min,max} → minScoreSetting / maxScoreSetting
 *   color → colorSetting
 *   posColor → posColorSetting
 *   negColor → negColorSetting
 *   showSidebar → showTreeSetting
 *   fill, minSize → stripped (no longer used)
 */
export function migrateWiggleSnapshot(
  snap: Record<string, unknown>,
  opts?: { multiWiggle?: boolean },
) {
  const needsMigration =
    snap.rendererTypeNameState !== undefined ||
    snap.selectedRendering !== undefined ||
    snap.scale !== undefined ||
    snap.autoscale !== undefined ||
    snap.summaryScoreMode !== undefined ||
    snap.constraints !== undefined ||
    snap.color !== undefined ||
    snap.posColor !== undefined ||
    snap.negColor !== undefined ||
    snap.showSidebar !== undefined

  if (!needsMigration) {
    return snap
  }

  const {
    rendererTypeNameState,
    selectedRendering,
    scale,
    autoscale,
    summaryScoreMode,
    constraints,
    showSidebar,
    fill,
    color,
    posColor,
    negColor,
    minSize,
    ...rest
  } = snap

  const oldRendering =
    (rendererTypeNameState as string) ?? (selectedRendering as string)
  const cons = constraints as { min?: number; max?: number } | undefined

  let renderingTypeSetting: string | undefined
  if (oldRendering !== undefined) {
    renderingTypeSetting =
      opts?.multiWiggle && oldRendering === 'xyplot'
        ? 'multixyplot'
        : oldRendering
  }

  return {
    ...rest,
    ...(renderingTypeSetting !== undefined ? { renderingTypeSetting } : {}),
    ...(scale !== undefined ? { scaleTypeSetting: scale } : {}),
    ...(autoscale !== undefined ? { autoscaleSetting: autoscale } : {}),
    ...(summaryScoreMode !== undefined
      ? { summaryScoreModeSetting: summaryScoreMode }
      : {}),
    ...(cons?.min !== undefined ? { minScoreSetting: cons.min } : {}),
    ...(cons?.max !== undefined ? { maxScoreSetting: cons.max } : {}),
    ...(color !== undefined ? { colorSetting: color } : {}),
    ...(posColor !== undefined ? { posColorSetting: posColor } : {}),
    ...(negColor !== undefined ? { negColorSetting: negColor } : {}),
    ...(showSidebar !== undefined ? { showTreeSetting: showSidebar } : {}),
  }
}
