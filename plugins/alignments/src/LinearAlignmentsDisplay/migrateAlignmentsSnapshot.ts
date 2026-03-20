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
 *   - Strips removed properties: blockState, showTooltips, userByteSizeLimit
 */
export function migrateAlignmentsSnapshot(snap: Record<string, unknown>) {
  if (!snap) {
    return snap
  }

  // Strip properties from old BaseLinearDisplayNoFeatureDensity snapshots
  const { blockState, showTooltips, userByteSizeLimit, ...cleaned } = snap
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
        ? (rest.colorBySetting ?? {
            type: 'insertSizeAndOrientation',
          })
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
        ? (rest.colorBySetting ?? {
            type: 'insertSizeAndOrientation',
          })
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

    return {
      ...rest,
      type: 'LinearAlignmentsDisplay',
      showSashimiArcs: showArcs ?? true,
      showInterbaseIndicators: showInterbaseIndicators ?? true,
      showCoverage: true,
      coverageHeight: 45,
      showMismatches: true,
      colorBySetting,
      filterBySetting,
      jexlFilters: jexlFilters ?? [],
    }
  }

  return result
}
