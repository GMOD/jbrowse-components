const OLD_DISPLAY_TYPES = new Set([
  'LinearPileupDisplay',
  'LinearReadArcsDisplay',
  'LinearReadCloudDisplay',
  'LinearSNPCoverageDisplay',
])

/**
 * Migrate old alignments display snapshots to the unified
 * LinearAlignmentsDisplay.
 *
 * v4.3.0 shipped four separate display types (LinearPileupDisplay /
 * LinearReadArcsDisplay / LinearReadCloudDisplay / LinearSNPCoverageDisplay)
 * that are now one LinearAlignmentsDisplay, so the only live remap is the
 * `type`. Every old per-display track-menu setting became a config slot (stored
 * under `configuration`, not on the display node), so its legacy top-level
 * snapshot key is silently ignored by MST — old display-instance values revert
 * to the config default. Real display props (`configuration`,
 * `userByteSizeLimit`, `displayId`) pass through untouched.
 */
export function migrateAlignmentsSnapshot(
  snap: Record<string, unknown> | undefined,
) {
  return snap &&
    typeof snap.type === 'string' &&
    OLD_DISPLAY_TYPES.has(snap.type)
    ? { ...snap, type: 'LinearAlignmentsDisplay' }
    : snap
}
