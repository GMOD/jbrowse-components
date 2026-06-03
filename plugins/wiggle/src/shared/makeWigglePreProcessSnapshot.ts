import { migrateWiggleSnapshot } from './migrateWiggleSnapshot.ts'

export function makeWigglePreProcessSnapshot(opts?: { multiWiggle?: boolean }) {
  return (snap: Record<string, unknown> | null | undefined) => {
    if (!snap) {
      return snap
    }
    // height/heightPreConfig → heightOverride is handled centrally by
    // TrackHeightMixin's migration, so it passes through untouched here.
    const { blockState, showLegend, showTooltips, ...withoutLegacy } = snap
    return migrateWiggleSnapshot(withoutLegacy, opts)
  }
}
