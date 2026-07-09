import { maxBottom } from './yMorph.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

// The fit-to-height escalation ladder's reservation levels, least to most
// reduced: `full` reserves names + descriptions, `labels` drops descriptions
// (names kept), `bodies` drops names too and packs boxes edge-to-edge. See
// `resolveFitLadder`.
export type FitLevel = 'full' | 'labels' | 'bodies'

// One rung: a reservation level and a thunk producing its laid-out stack. Lazy so
// a rung tighter than the one that fits is never laid out — in the common
// non-overflowing case only `full` is materialized.
export interface FitRung {
  level: FitLevel
  layout: () => Map<number, FeatureDataResult>
}

// The resolved fit outcome, bundled so its three parts can't disagree: which
// rung's `layout` won, its `level`, and the uniform vertical `scale`. `full`/
// `labels` always resolve at scale 1; only `bodies` (the last rung) is squeezed.
export interface FitStage {
  level: FitLevel
  layout: Map<number, FeatureDataResult>
  scale: number
}

// Uniform vertical scale that makes a `contentHeight` stack fill exactly
// `trackHeight`, clamped to [minScale, 1]. `Math.min(1, …)` never enlarges a
// stack that already fits; `Math.max(minScale, …)` never shrinks a feature body
// below the min-box floor — past that the surplus scrolls instead. `contentHeight`
// is always > 0 at the only call site (an overflowing rung, whose height exceeds
// `trackHeight` >= 0), so there is no divide-by-zero.
export function fitSqueezeScale(
  contentHeight: number,
  trackHeight: number,
  minScale: number,
) {
  return Math.max(minScale, Math.min(1, trackHeight / contentHeight))
}

// Resolve the escalation ladder: keep the least-reduced rung whose unscaled stack
// fits `trackHeight` (rendered at scale 1). A rung that overflows descends to the
// next; the last rung has no next, so it is squeezed to fill the track (floored
// at `minScale`) and scrolls if even that overflows. Only that last rung ever
// scales. Rungs are laid out lazily in order, so rungs tighter than the kept one
// are never computed.
export function resolveFitLadder(
  rungs: FitRung[],
  trackHeight: number,
  minScale: number,
): FitStage {
  const walk = (i: number): FitStage => {
    const { level, layout: getLayout } = rungs[i]!
    const layout = getLayout()
    const contentHeight = maxBottom(layout)
    return contentHeight <= trackHeight
      ? { level, layout, scale: 1 }
      : i === rungs.length - 1
        ? {
            level,
            layout,
            scale: fitSqueezeScale(contentHeight, trackHeight, minScale),
          }
        : walk(i + 1)
  }
  return walk(0)
}
