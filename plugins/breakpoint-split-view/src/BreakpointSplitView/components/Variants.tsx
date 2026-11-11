import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { assembleLocString } from '@jbrowse/core/util'
import { breakendTickPx } from '@jbrowse/sv-core'
import { observer } from 'mobx-react'

import { computeOverlayX } from '../util.ts'
import {
  OverlayPaths,
  buildJunctionPath,
  buildPairTooltip,
  variantJunctionColor,
  variantWidgetOpener,
} from './overlayUtils.tsx'
import { connectedVariantJunctions } from './variantJunctions.ts'

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

// One connector per junction, for every kind of variant record: a VCF breakend, a
// symbolic SV with INFO.CHR2/END, or a paired adapter's row. They used to be
// three overlays behind a per-track classification, which drew a mixed callset
// as whichever kind it saw first and gave a symbolic DEL/DUP/INV no curve at
// all. junctionEnds answers for all of them, so what is left is geometry.
const Variants = observer(function Variants(props: OverlayProps) {
  const palette = usePalette()
  return (
    <OverlayPaths
      {...props}
      pathTestId="r2"
      stroke={variantJunctionColor(palette)}
      strokeWidth={5}
      hoverStrokeWidth={10}
      render={variantPaths}
    />
  )
})

export default Variants

export function variantPaths({
  session,
  match,
  views,
  tracks,
  layouts,
  getX,
  getY,
  assemblies,
}: OverlayContext) {
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
  return connectedVariantJunctions({
    match,
    views,
    tracks,
    assemblies,
  }).flatMap<PathSpec>(({ near, far, ends, mateEnd, farLevel }) => {
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
