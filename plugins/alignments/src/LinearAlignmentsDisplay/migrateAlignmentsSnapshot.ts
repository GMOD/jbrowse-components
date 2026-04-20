/**
 * Migrates old alignments display snapshot properties to the current
 * LinearAlignmentsDisplay format.
 *
 * Handles:
 *   - LinearPileupDisplay → LinearAlignmentsDisplay type remap
 *   - LinearReadArcsDisplay → LinearAlignmentsDisplay type remap
 *   - LinearReadCloudDisplay → LinearAlignmentsDisplay type remap
 *   - LinearSNPCoverageDisplay → LinearAlignmentsDisplay type remap + property migration
 *   - Old nested PileupDisplay/SNPCoverageDisplay sub-display format
 *   - renderingMode → showLinkedReads
 *   - showReadCloud → showLinkedReads
 *   - height → heightPreConfig
 *   - Individual override properties → configOverrides map
 *   - Strips removed properties: blockState, showTooltips
 */
export function migrateAlignmentsSnapshot(
  snap: Record<string, unknown>,
): Record<string, unknown>
export function migrateAlignmentsSnapshot(
  snap: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined
export function migrateAlignmentsSnapshot(
  snap: Record<string, unknown> | undefined,
) {
  if (!snap) {
    return snap
  }

  // Strip properties from old BaseLinearDisplayNoFeatureDensity snapshots.
  // userByteSizeLimit is kept — it persists the user's force-load threshold
  // via RegionTooLargeMixin so it survives session restore.
  const { blockState, showTooltips, ...cleaned } = snap
  let result = cleaned

  // Rewrite "height" from older snapshots to "heightPreConfig"
  if (result.height !== undefined && result.heightPreConfig === undefined) {
    const { height, ...rest } = result
    result = { ...rest, heightPreConfig: height }
  }

  // Remap old display types to LinearAlignmentsDisplay
  if (
    result.type === 'LinearPileupDisplay' ||
    result.type === 'LinearReadArcsDisplay' ||
    result.type === 'LinearReadCloudDisplay'
  ) {
    result = { ...result, type: 'LinearAlignmentsDisplay' }
  }

  // Migrate old renderingMode to new boolean toggles
  if (result.renderingMode) {
    const { renderingMode, ...rest } = result
    const linked = renderingMode === 'linkedRead' || renderingMode === 'cloud'
    result = {
      ...rest,
      showLinkedReads: linked,
      colorBySetting: linked
        ? (rest.colorBySetting ?? { type: 'insertSizeAndOrientation' })
        : rest.colorBySetting,
    }
  }

  // Strip removed showReadCloud property from old snapshots
  if (result.showReadCloud !== undefined) {
    const { showReadCloud, ...rest } = result
    const linked = result.showLinkedReads || showReadCloud
    result = {
      ...rest,
      showLinkedReads: linked,
      colorBySetting: linked
        ? (rest.colorBySetting ?? { type: 'insertSizeAndOrientation' })
        : rest.colorBySetting,
    }
  }

  // Migrate old nested PileupDisplay/SNPCoverageDisplay sub-display format
  // from v1.x LinearAlignmentsDisplay sessions
  if (result.PileupDisplay || result.SNPCoverageDisplay) {
    const { PileupDisplay, SNPCoverageDisplay, snpCovHeight, ...rest } = result
    const pileup = (PileupDisplay ?? {}) as Record<string, unknown>
    result = {
      ...rest,
      showSoftClipping: pileup.showSoftClipping ?? false,
      colorBySetting: pileup.colorBy,
      filterBySetting: pileup.filterBy,
      coverageHeight: snpCovHeight ?? 45,
    }
  }

  // Migrate LinearSNPCoverageDisplay snapshots to LinearAlignmentsDisplay
  if (result.type === 'LinearSNPCoverageDisplay') {
    const {
      type,
      showArcs,
      minArcScore,
      showInterbaseCounts,
      showInterbaseIndicators,
      colorBySetting,
      filterBySetting,
      jexlFilters,
      ...rest
    } = result

    result = {
      ...rest,
      type: 'LinearAlignmentsDisplay',
      sashimiArcsState: { showSashimiArcs: showArcs ?? true },
      showInterbaseIndicators: showInterbaseIndicators ?? true,
      showCoverage: true,
      coverageHeight: 45,
      showMismatches: true,
      colorBySetting,
      filterBySetting,
      jexlFilters: jexlFilters ?? [],
    }
  }

  // Migrate flat sashimi/pairedArcsDown properties → submodel paths
  const {
    showSashimiArcs,
    sashimiArcsDown,
    sashimiArcsHeight,
    pairedArcsDown,
    ...stripped
  } = result
  result = stripped

  if (
    showSashimiArcs !== undefined ||
    sashimiArcsDown !== undefined ||
    sashimiArcsHeight !== undefined
  ) {
    const existing = (result.sashimiArcsState ?? {}) as Record<string, unknown>
    result = {
      ...result,
      sashimiArcsState: {
        ...existing,
        ...(showSashimiArcs !== undefined ? { showSashimiArcs } : {}),
        ...(sashimiArcsDown !== undefined ? { sashimiArcsDown } : {}),
        ...(sashimiArcsHeight !== undefined ? { sashimiArcsHeight } : {}),
      },
    }
  }

  if (pairedArcsDown !== undefined) {
    const existing = (result.arcsState ?? {}) as Record<string, unknown>
    result = { ...result, arcsState: { ...existing, pairedArcsDown } }
  }

  // Migrate individual override properties → configOverrides
  return migrateOverrideProperties(result)
}

function migrateOverrideProperties(snap: Record<string, unknown>) {
  const {
    colorBySetting,
    filterBySetting,
    featureHeight,
    noSpacing,
    showOutline,
    mismatchAlpha,
    showLegend,
    sortedBySetting,
    trackMaxHeight,
    ...rest
  } = snap

  const overrides: Record<string, unknown> = {}
  if (colorBySetting !== undefined) {
    overrides.colorBy = colorBySetting
  }
  if (filterBySetting !== undefined) {
    overrides.filterBy = filterBySetting
  }
  if (featureHeight !== undefined) {
    overrides.featureHeight = featureHeight
  }
  if (noSpacing !== undefined) {
    overrides.noSpacing = noSpacing
  }
  if (showOutline !== undefined) {
    overrides.showOutline = showOutline
  }
  if (mismatchAlpha !== undefined) {
    overrides.mismatchAlpha = mismatchAlpha
  }
  if (showLegend !== undefined) {
    overrides.showLegend = showLegend
  }
  if (sortedBySetting !== undefined) {
    overrides.sortedBy = sortedBySetting
  }
  if (trackMaxHeight !== undefined) {
    overrides.maxHeight = trackMaxHeight
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
