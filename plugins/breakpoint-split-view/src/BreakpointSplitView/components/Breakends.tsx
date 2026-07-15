import {
  VariantOverlay,
  buildBreakpointPath,
  canonicalPairs,
  tickAtPx,
} from './overlayUtils.tsx'
import { findMatchingAlt } from './util.ts'

import type { OverlayProps, PathSpec } from './overlayUtils.tsx'

export default function Breakends(props: OverlayProps) {
  return (
    <VariantOverlay
      {...props}
      pathTestId="r2"
      render={ctx => {
        const { views } = ctx
        return [...canonicalPairs(ctx)].flatMap<PathSpec>(
          ({ f1, f2, level1, level2, x1, y1, x2, y2, tooltip }) => {
            const relevantAlt = findMatchingAlt(f1, f2)
            if (!relevantAlt) {
              return []
            }
            const x1Tick = tickAtPx(
              views,
              level1,
              x1,
              relevantAlt.Join === 'left' ? -1 : 1,
            )
            const x2Tick = tickAtPx(
              views,
              level2,
              x2,
              relevantAlt.MateDirection === 'left' ? 1 : -1,
            )
            return [
              {
                id: f1.id(),
                path: buildBreakpointPath(x1, y1, x2, y2, x1Tick, x2Tick),
                tooltip,
              },
            ]
          },
        )
      }}
    />
  )
}
