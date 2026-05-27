import {
  LEFT,
  VariantOverlay,
  buildBreakpointPath,
  getCanonicalRefPair,
  isLevelPairMinimized,
  tickX,
} from './overlayUtils.tsx'
import { findMatchingAlt } from './util.ts'

import type { OverlayProps, PathSpec } from './overlayUtils.tsx'

export default function Breakends(props: OverlayProps) {
  return (
    <VariantOverlay
      {...props}
      pathTestId="r2"
      render={({ match, assembly, views, tracks, getX, getY }) =>
        match.layoutMatches.flatMap(chunk =>
          chunk.slice(0, -1).flatMap<PathSpec>((item, i) => {
            const next = chunk[i + 1]!
            const { layout: c1, feature: f1, level: level1 } = item
            const { layout: c2, feature: f2, level: level2 } = next
            if (isLevelPairMinimized(tracks, level1, level2)) {
              return []
            }
            const relevantAlt = findMatchingAlt(f1, f2)
            if (!relevantAlt) {
              console.warn('the relevant ALT allele was not found, cannot render')
              return []
            }
            const refs = getCanonicalRefPair(
              assembly,
              f1.get('refName'),
              f2.get('refName'),
            )
            if (!refs) {
              return []
            }
            const x1 = getX(level1, refs.f1ref, c1[LEFT]) ?? 0
            const x2 = getX(level2, refs.f2ref, c2[LEFT]) ?? 0
            const y1 = getY(level1, c1)
            const y2 = getY(level2, c2)
            const reversed1 = views[level1]!.pxToBp(x1).reversed
            const reversed2 = views[level2]!.pxToBp(x2).reversed
            const x1Tick = tickX(x1, relevantAlt.Join === 'left' ? -1 : 1, reversed1)
            const x2Tick = tickX(x2, relevantAlt.MateDirection === 'left' ? 1 : -1, reversed2)
            return [
              {
                id: f1.id(),
                path: buildBreakpointPath(x1, y1, x2, y2, x1Tick, x2Tick),
              },
            ]
          }),
        )
      }
    />
  )
}
