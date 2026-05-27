import { readTranslocationMate } from '@jbrowse/sv-core'

import {
  LEFT,
  VariantOverlay,
  buildBreakpointPath,
  isLevelPairMinimized,
  strandToSign,
  tickX,
} from './overlayUtils.tsx'

import type { OverlayProps, PathSpec } from './overlayUtils.tsx'
import type { LayoutRecord } from '../types.ts'

// We hardcode the TRA to go to the "other view"; if there is none, return
// nothing. Properly resolving would mean walking INFO.CHR2/END to find which
// view contains the mate.
export default function Translocations(props: OverlayProps) {
  return (
    <VariantOverlay
      {...props}
      render={({ match, views, tracks, getX, getY }) => {
        if (views.length < 2) {
          return []
        }
        return match.layoutMatches.flatMap(chunk =>
          chunk.flatMap<PathSpec>(
            ({ layout: c1, feature: f1, level: level1 }) => {
              const level2 = level1 === 0 ? 1 : 0
              if (isLevelPairMinimized(tracks, level1, level2)) {
                return []
              }
              const mate = readTranslocationMate(f1.get('INFO'))
              if (!mate) {
                return []
              }
              const x2 = getX(level2, mate.chr, mate.pos)
              if (x2 == null) {
                return []
              }
              const c2: LayoutRecord = [x2, 0, x2 + 1, 0]
              const x1 = getX(level1, f1.get('refName'), c1[LEFT]) ?? 0
              const y1 = getY(level1, c1)
              const y2 = getY(level2, c2)
              const reversed1 = views[level1]!.pxToBp(x1).reversed
              const reversed2 = views[level2]!.pxToBp(x2).reversed
              return [
                {
                  id: f1.id(),
                  path: buildBreakpointPath(
                    x1,
                    y1,
                    x2,
                    y2,
                    tickX(x1, strandToSign(mate.myDir), reversed1),
                    tickX(x2, strandToSign(mate.mateDir), reversed2),
                  ),
                },
              ]
            },
          ),
        )
      }}
    />
  )
}
