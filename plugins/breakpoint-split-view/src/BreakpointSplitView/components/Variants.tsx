import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { assembleLocString } from '@jbrowse/core/util'
import { breakendTickPx, junctionEnds } from '@jbrowse/sv-core'

import { computeOverlayX, findFeatureViewLevel } from './overlayGeometry.ts'
import {
  OverlayPaths,
  buildBreakpointPath,
  buildPairTooltip,
  isLevelPairMinimized,
  variantWidgetOpener,
} from './overlayUtils.tsx'

import type { LayoutRecord } from '../types.ts'
import type { OverlayContext, OverlayProps, PathSpec } from './overlayUtils.tsx'
import type { JunctionEnd } from '@jbrowse/sv-core'

// The far end of a junction whose own record the fetch didn't return has no row
// in the pileup, so its y snaps to the track top (getY reads slots 1 and 3).
const NO_LAYOUT: LayoutRecord = [0, 0, 0, 0]

// One curve per junction, for every kind of variant record: a VCF breakend, a
// symbolic SV with INFO.CHR2/END, or a paired adapter's row. They used to be
// three overlays behind a per-track classification, which drew a mixed callset
// as whichever kind it saw first and gave a symbolic DEL/DUP/INV no curve at
// all. junctionEnds answers for all of them, so what is left is geometry.
export default function Variants(props: OverlayProps) {
  const palette = usePalette()
  return (
    <OverlayPaths
      {...props}
      pathTestId="r2"
      stroke={palette.success.main}
      strokeWidth={5}
      hoverStrokeWidth={10}
      render={ctx => variantPaths(ctx, props.model.showIntraviewLinks)}
    />
  )
}

export function variantPaths(
  {
    session,
    match,
    views,
    tracks,
    layouts,
    getX,
    getY,
    assemblies,
  }: OverlayContext,
  showIntraviewLinks: boolean,
) {
  // per ROW, for the reason getCanonicalRefPair gives: the rows are
  // independently assembly-picked
  const canon = (level: number, refName: string) =>
    assemblies[level]?.getCanonicalRefName2(refName) ?? refName
  const place = (end: JunctionEnd, level: number, layout: LayoutRecord) => {
    const placed = getX(level, canon(level, end.refName), end.pos)
    if (!placed) {
      return undefined
    }
    const x = computeOverlayX(placed.x, layouts[level]!.width, layout)
    return {
      x,
      y: getY(level, layout),
      tick: breakendTickPx(x, end.keeps, placed.reversed),
    }
  }
  return match.layoutMatches.flatMap<PathSpec>(([near, far]) => {
    const ends = near && junctionEnds(near.feature)
    if (!near || !ends) {
      return []
    }
    // the far record's own end where the fetch returned it, so the position and
    // the kept side are both in the spelling that record's row resolves
    const mateEnd = (far && junctionEnds(far.feature)?.own) ?? ends.mate
    const farLevel =
      far?.level ??
      findFeatureViewLevel(views, assemblies, mateEnd.refName, mateEnd.pos)
    if (
      farLevel === undefined ||
      (!showIntraviewLinks && farLevel === near.level) ||
      isLevelPairMinimized(tracks, near.level, farLevel)
    ) {
      return []
    }
    const p1 = place(ends.own, near.level, near.layout)
    const p2 = place(mateEnd, farLevel, far?.layout ?? NO_LAYOUT)
    if (!p1 || !p2) {
      return []
    }
    return [
      {
        id: near.feature.id(),
        path: buildBreakpointPath(p1.x, p1.y, p2.x, p2.y, p1.tick, p2.tick),
        tooltip: () =>
          buildPairTooltip(
            near.feature,
            far?.feature ??
              assembleLocString({
                refName: mateEnd.refName,
                start: mateEnd.pos,
                end: mateEnd.pos + 1,
              }),
          ),
        openWidget: variantWidgetOpener(session, near.feature),
      },
    ]
  })
}
