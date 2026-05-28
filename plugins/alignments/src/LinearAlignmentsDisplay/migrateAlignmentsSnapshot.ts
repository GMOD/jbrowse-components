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
 *   - renderingMode → linkedReads enum
 *   - showReadCloud → linkedReads enum
 *   - showLinkedReads + showLinkedReadsAsBeziers booleans → linkedReads enum
 *   - showArcs + pairedArcsDown booleans → pairedArcs enum
 *   - showSashimiArcs + sashimiArcsDown booleans → sashimiArcs enum
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
      // jexlFilters: dropped — the alignments display has no jexl-filter
      // path (FilterBy is flag/tag/readName only), so the old SNPCoverage
      // field had no effect and is discarded on migration.
      jexlFilters: _jexlFilters,
      ...rest
    } = result

    result = {
      ...rest,
      type: 'LinearAlignmentsDisplay',
      showSashimiArcs: showArcs ?? true,
      showInterbaseIndicators: showInterbaseIndicators ?? true,
      showCoverage: true,
      coverageHeight: 45,
      showMismatches: true,
      colorBySetting,
      filterBySetting,
    }
  }

  // Fold paired boolean toggles into single enum fields
  result = migrateBooleanPairsToEnum(result)

  // arcColorByType: 'samplot' → pairedArcs: 'samplot' (samplot is now a
  // pairedArcs mode rather than a color scheme).
  if (result.arcColorByType === 'samplot') {
    result = {
      ...result,
      arcColorByType: 'insertSizeAndOrientation',
      pairedArcs: 'samplot',
    }
  }

  // Migrate individual override properties → configOverrides
  return migrateOverrideProperties(result)
}

function migrateBooleanPairsToEnum(snap: Record<string, unknown>) {
  const {
    showLinkedReads,
    showLinkedReadsAsBeziers,
    showArcs,
    pairedArcsDown,
    showSashimiArcs,
    sashimiArcsDown,
    ...rest
  } = snap

  const result: Record<string, unknown> = { ...rest }

  if (showLinkedReads !== undefined || showLinkedReadsAsBeziers !== undefined) {
    result.linkedReads = showLinkedReads
      ? showLinkedReadsAsBeziers
        ? 'bezier'
        : 'normal'
      : 'off'
  }

  if (showArcs !== undefined || pairedArcsDown !== undefined) {
    result.pairedArcs = showArcs ? (pairedArcsDown ? 'down' : 'up') : 'off'
  }

  if (showSashimiArcs !== undefined || sashimiArcsDown !== undefined) {
    // Old default was showSashimiArcs=true, sashimiArcsDown=false → 'up'
    result.sashimiArcs =
      showSashimiArcs === false ? 'off' : sashimiArcsDown ? 'down' : 'up'
  }

  return result
}

function migrateOverrideProperties(snap: Record<string, unknown>) {
  const {
    colorBySetting,
    filterBySetting,
    featureHeight,
    featureSpacing,
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
  // featureSpacing override directly maps; legacy noSpacing boolean folds
  // into it (true → 0, false → 2 to preserve the pre-unification render).
  // featureSpacing wins if both are present in an in-flight session.
  if (featureSpacing !== undefined) {
    overrides.featureSpacing = featureSpacing
  } else if (noSpacing !== undefined) {
    overrides.featureSpacing = noSpacing ? 0 : 2
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
