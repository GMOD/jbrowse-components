import { assembleLocString } from '@jbrowse/core/util'
import { readTranslocationMate } from '@jbrowse/sv-core'

import { findFeatureViewLevel } from '../util.ts'
import {
  LEFT,
  VariantOverlay,
  buildBreakpointPath,
  buildPairTooltip,
  isLevelPairMinimized,
  strandToSign,
  tickAtPx,
} from './overlayUtils.tsx'

import type { LayoutRecord } from '../types.ts'
import type { OverlayProps, PathSpec } from './overlayUtils.tsx'

// Resolve the TRA mate to whichever view (row) actually contains its
// INFO.CHR2/END position, so connections draw correctly across any number of
// rows. If no view contains the mate, draw nothing.
export default function Translocations(props: OverlayProps) {
  return (
    <VariantOverlay
      {...props}
      render={({ match, views, tracks, layouts, getX, getY }) => {
        if (views.length < 2) {
          return []
        }
        return match.layoutMatches.flatMap(chunk =>
          chunk.flatMap<PathSpec>(
            ({ layout: c1, feature: f1, level: level1 }) => {
              const mate = readTranslocationMate(
                f1.get('INFO') as {
                  CHR2?: string[]
                  END?: number[]
                  STRANDS?: string[]
                },
              )
              if (!mate) {
                return []
              }
              // mate.pos is the raw VCF INFO.END (1-based); convert to 0-based
              // for bpToPx, matching getBreakendCoveringRegions
              const matePos = mate.pos - 1
              const level2 = findFeatureViewLevel(views, mate.chr, matePos)
              if (
                level2 === undefined ||
                isLevelPairMinimized(tracks, level1, level2)
              ) {
                return []
              }
              const x2 = getX(level2, mate.chr, matePos)
              if (x2 == null) {
                return []
              }
              // getY only reads the y-slots (indices 1,3); the mate has no
              // pileup layout so both are 0 (snaps to the track top). x2 comes
              // from getX above, not from this record.
              const c2: LayoutRecord = [0, 0, 0, 0]
              const x1 = getX(level1, f1.get('refName'), c1[LEFT])
              if (x1 == null) {
                return []
              }
              const y1 = getY(level1, c1)
              const y2 = getY(level2, c2)
              const mateLoc = assembleLocString({
                refName: mate.chr,
                start: matePos,
                end: matePos + 1,
              })
              return [
                {
                  id: f1.id(),
                  path: buildBreakpointPath(
                    x1,
                    y1,
                    x2,
                    y2,
                    tickAtPx(layouts, level1, x1, strandToSign(mate.myDir)),
                    tickAtPx(layouts, level2, x2, strandToSign(mate.mateDir)),
                  ),
                  tooltip: buildPairTooltip(f1, mateLoc),
                },
              ]
            },
          ),
        )
      }}
    />
  )
}
