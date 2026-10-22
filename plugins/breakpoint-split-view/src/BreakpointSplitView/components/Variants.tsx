import { assembleLocString } from '@jbrowse/core/util'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import { breakendTickPx, junctionEnds } from '@jbrowse/sv-core'
import { observer } from 'mobx-react'

import {
  computeOverlayX,
  findFeatureViewLevel,
  isLevelPairMinimized,
} from '../util.ts'
import {
  OverlayPaths,
  buildJunctionPath,
  buildPairTooltip,
  variantWidgetOpener,
} from './overlayUtils.tsx'

import type { LayoutRecord } from '../types.ts'
import type {
  JunctionPoint,
  OverlayContext,
  OverlayProps,
  PathSpec,
} from './overlayUtils.tsx'
import type { JunctionEnd } from '@jbrowse/sv-core'

// The far end of a junction whose own record the fetch didn't return has no row
// in the pileup, so its y snaps to the track top (getY reads slots 1 and 3).
const NO_LAYOUT: LayoutRecord = [0, 0, 0, 0]

// One curve per junction, for every kind of variant record: a VCF breakend, a
// symbolic SV with INFO.CHR2/END, or a paired adapter's row. They used to be
// three overlays behind a per-track classification, which drew a mixed callset
// as whichever kind it saw first and gave a symbolic DEL/DUP/INV no curve at
// all. junctionEnds answers for all of them, so what is left is geometry.
const Variants = observer(function Variants(props: OverlayProps) {
  return (
    <OverlayPaths
      {...props}
      pathTestId="r2"
      stroke={DEFAULT_MARK_COLOR}
      strokeWidth={5}
      hoverStrokeWidth={10}
      render={ctx => variantPaths(ctx, props.model.showIntraviewLinks)}
    />
  )
})

export default Variants

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
  if (match.kind !== 'variant') {
    return []
  }
  // per ROW: the rows are independently assembly-picked, so one shared
  // resolver would drop every contig of the rows it does not answer for
  const canon = (level: number, refName: string) =>
    assemblies[level]?.getCanonicalRefName2(refName) ?? refName
  const place = (
    end: JunctionEnd,
    level: number,
    layout: LayoutRecord,
    y: number,
  ): JunctionPoint | undefined => {
    const placed = getX(level, canon(level, end.refName), end.pos)
    if (!placed) {
      return undefined
    }
    const { reversed } = placed
    const x = computeOverlayX(placed.x, layouts[level]!.width, layout)
    return {
      x,
      y,
      tick: breakendTickPx(x, end.keeps, reversed),
      keeps: end.keeps,
      reversed,
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
    const farLayout = far?.layout ?? NO_LAYOUT
    // Each end meets its feature on the side facing the other end, so the
    // connector stays clear of the labels a feature draws under its glyph; a
    // pair at one height bows over the top of both.
    const mid1 = getY(near.level, near.layout)
    const mid2 = getY(farLevel, farLayout)
    const p1 = place(
      ends.own,
      near.level,
      near.layout,
      getY(near.level, near.layout, mid1 < mid2 ? 1 : 0),
    )
    const p2 = place(
      mateEnd,
      farLevel,
      farLayout,
      getY(farLevel, farLayout, mid2 < mid1 ? 1 : 0),
    )
    if (!p1 || !p2) {
      return []
    }
    return [
      {
        id: near.feature.id(),
        path: buildJunctionPath(p1, p2),
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
