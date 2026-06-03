import { migrateWiggleSnapshot } from './migrateWiggleSnapshot.ts'

export function makeWigglePreProcessSnapshot(opts?: { multiWiggle?: boolean }) {
  return (snap: Record<string, unknown> | null | undefined) => {
    if (!snap) {
      return snap
    }
    const { blockState, showLegend, showTooltips, ...withoutLegacy } = snap
    if (
      withoutLegacy.height !== undefined &&
      withoutLegacy.heightOverride === undefined
    ) {
      const { height, ...rest } = withoutLegacy
      return migrateWiggleSnapshot({ ...rest, heightOverride: height }, opts)
    }
    return migrateWiggleSnapshot(withoutLegacy, opts)
  }
}
