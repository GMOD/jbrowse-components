import { assembleLocString } from '@jbrowse/core/util'
import { readTranslocationMate } from '@jbrowse/sv-core'

import { findFeatureViewLevel } from './overlayGeometry.ts'
import {
  LEFT,
  VariantOverlay,
  buildBreakpointPath,
  buildPairTooltip,
  isLevelPairMinimized,
  tickAtPx,
  variantWidgetOpener,
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
      render={({
        session,
        match,
        views,
        tracks,
        layouts,
        getX,
        getY,
        assemblies,
      }) => {
        if (views.length < 2) {
          return []
        }
        // bpToPx matches displayedRegions by exact refName, so both the mate's
        // INFO.CHR2 and f1's refName have to be canonicalized first or an
        // aliased one (VCF 'chr2' vs the view's '2') resolves to no level/px and
        // the connection is silently dropped. Per ROW, because the rows are
        // independently assembly-picked and one shared resolver renames every
        // contig into row 0's namespace. Matches getMatchedFeaturesInLayout and
        // getCanonicalRefPair.
        const canon = (level: number, r: string) =>
          assemblies[level]?.getCanonicalRefName2(r) ?? r
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
              const level2 = findFeatureViewLevel(
                views,
                assemblies,
                mate.chr,
                matePos,
              )
              if (
                level2 === undefined ||
                isLevelPairMinimized(tracks, level1, level2)
              ) {
                return []
              }
              const mateChr = canon(level2, mate.chr)
              const x2 = getX(level2, mateChr, matePos)
              if (x2 == null) {
                return []
              }
              // getY only reads the y-slots (indices 1,3); the mate has no
              // pileup layout so both are 0 (snaps to the track top). x2 comes
              // from getX above, not from this record.
              const c2: LayoutRecord = [0, 0, 0, 0]
              const x1 = getX(
                level1,
                canon(level1, f1.get('refName')),
                c1[LEFT],
              )
              if (x1 == null) {
                return []
              }
              const y1 = getY(level1, c1)
              const y2 = getY(level2, c2)
              return [
                {
                  id: f1.id(),
                  path: buildBreakpointPath(
                    x1,
                    y1,
                    x2,
                    y2,
                    tickAtPx(layouts, level1, x1, mate.myKeepsDir),
                    tickAtPx(layouts, level2, x2, mate.mateKeepsDir),
                  ),
                  tooltip: () =>
                    buildPairTooltip(
                      f1,
                      assembleLocString({
                        refName: mateChr,
                        start: matePos,
                        end: matePos + 1,
                      }),
                    ),
                  openWidget: variantWidgetOpener(session, f1),
                },
              ]
            },
          ),
        )
      }}
    />
  )
}
