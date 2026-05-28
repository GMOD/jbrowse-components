import {
  LEFT,
  VariantOverlay,
  buildSimplePath,
  getCanonicalRefPair,
  isLevelPairMinimized,
} from './overlayUtils.tsx'

import type { OverlayProps, PathSpec } from './overlayUtils.tsx'

export default function PairedFeatures(props: OverlayProps) {
  return (
    <VariantOverlay
      {...props}
      pathTestId="r2"
      render={({ match, assembly, tracks, getX, getY }) =>
        match.layoutMatches.flatMap(chunk =>
          chunk.slice(0, -1).flatMap<PathSpec>((item, i) => {
            const next = chunk[i + 1]!
            const { layout: c1, feature: f1, level: level1 } = item
            const { layout: c2, feature: f2, level: level2 } = next
            if (isLevelPairMinimized(tracks, level1, level2)) {
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
            const x1 = getX(level1, refs.f1ref, c1[LEFT])
            const x2 = getX(level2, refs.f2ref, c2[LEFT])
            if (x1 == null || x2 == null) {
              return []
            }
            const y1 = getY(level1, c1)
            const y2 = getY(level2, c2)
            return [
              {
                id: f1.id(),
                path: buildSimplePath(x1, y1, x2, y2),
              },
            ]
          }),
        )
      }
    />
  )
}
