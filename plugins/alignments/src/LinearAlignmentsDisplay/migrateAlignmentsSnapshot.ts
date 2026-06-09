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
 *   - linkedReads 'bezier' → linkedReads 'off' + showBezierConnections overlay
 *   - showArcs + pairedArcsDown booleans → pairedArcs enum
 *   - pairedArcs enum → readConnections mode + readConnectionsDown direction
 *   - sashimiArcsDown dropped (direction is the shared readConnectionsDown)
 *   - arcsHeight → readConnectionsHeight
 *   - Individual override properties → flat config keys
 *   - lineWidth / lineWidthSetting → readConnectionsLineWidth
 *   - sortedBy / sortedBySetting → sortedBy
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

  // height/heightPreConfig → heightOverride is handled centrally by
  // TrackHeightMixin's migration, so it's left untouched here.

  // arcsHeight → readConnectionsHeight (the read-connections band height,
  // renamed when the band stopped being arc-specific)
  if (
    result.arcsHeight !== undefined &&
    result.readConnectionsHeight === undefined
  ) {
    const { arcsHeight, ...rest } = result
    result = { ...rest, readConnectionsHeight: arcsHeight }
  }

  // Remap old display types to LinearAlignmentsDisplay
  if (
    [
      'LinearPileupDisplay',
      'LinearReadArcsDisplay',
      'LinearReadCloudDisplay',
    ].includes(result.type)
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
  // read-connections mode rather than a color scheme).
  if (result.arcColorByType === 'samplot') {
    result = {
      ...result,
      arcColorByType: 'insertSizeAndOrientation',
      pairedArcs: 'samplot',
    }
  }

  // Split the pairedArcs enum into orthogonal mode + direction fields
  result = migrateReadConnections(result)

  return migrateOverrideProperties(result)
}

// pairedArcs ('off'|'up'|'down'|'samplot') conflated render mode with
// direction. Split into readConnections ('off'|'arc'|'samplot') and the
// orthogonal readConnectionsDown boolean.
function migrateReadConnections(snap: Record<string, unknown>) {
  const { pairedArcs, ...rest } = snap
  if (pairedArcs === undefined) {
    return snap
  }
  return {
    ...rest,
    readConnections:
      pairedArcs === 'off' || pairedArcs === 'samplot' ? pairedArcs : 'arc',
    readConnectionsDown: pairedArcs === 'down',
  }
}

function migrateBooleanPairsToEnum(snap: Record<string, unknown>) {
  const {
    showLinkedReads,
    showLinkedReadsAsBeziers,
    showArcs,
    pairedArcsDown,
    // Direction is now the single shared `readConnectionsDown` band
    // orientation, so the old per-feature sashimi direction is dropped.
    // `showSashimiArcs` is already the current field name and flows through.
    sashimiArcsDown: _sashimiArcsDown,
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

  // 'bezier' is no longer a `linkedReads` layout mode — it became the
  // orthogonal `showBezierConnections` overlay. Remap stored/derived 'bezier'
  // to the ideal pileup + curves look. Runs for enum-era snapshots too.
  if (result.linkedReads === 'bezier') {
    result.linkedReads = 'off'
    result.showBezierConnections = true
  }

  if (showArcs !== undefined || pairedArcsDown !== undefined) {
    result.pairedArcs = showArcs ? (pairedArcsDown ? 'down' : 'up') : 'off'
  }

  return result
}

function migrateOverrideProperties(snap: Record<string, unknown>) {
  const {
    colorBySetting,
    filterBySetting,
    featureHeight,
    featureSpacing,
    // released displays used bare `lineWidth`/`sortedBy`; a later naming added
    // the `*Setting` suffix. Accept both (suffixed wins) → the new override.
    lineWidth,
    lineWidthSetting,
    noSpacing,
    showOutline,
    mismatchAlpha,
    showLegend,
    sortedBy,
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
  const lineWidthVal = lineWidthSetting ?? lineWidth
  if (lineWidthVal !== undefined) {
    overrides.readConnectionsLineWidth = lineWidthVal
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
  const sortedByVal = sortedBySetting ?? sortedBy
  if (sortedByVal !== undefined) {
    overrides.sortedBy = sortedByVal
  }
  if (trackMaxHeight !== undefined) {
    overrides.maxHeight = trackMaxHeight
  }

  return { ...rest, ...overrides }
}
