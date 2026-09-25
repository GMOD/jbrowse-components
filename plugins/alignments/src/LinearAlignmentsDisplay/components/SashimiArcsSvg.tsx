import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'

import { sashimiArcColor } from '../../features/sashimi/computeOverlay.ts'
import SashimiArcLabels from './SashimiArcLabels.tsx'
import { SASHIMI_SIDES, sashimiArcKey, sashimiSideBand } from './sashimiArcs.ts'
import { bandScreenTop } from './sectionScreen.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

// One side's arcs at its sub-band's top, clipped to the same box the screen
// clips (`sashimiSideBand`). Paths first, labels second, so a count is never
// buried under a neighbouring arc's stroke.
function SashimiSide({
  arcs,
  top,
  height,
  clipped,
  clipId,
  width,
  showLabels,
  palette,
}: {
  arcs: SashimiArc[]
  top: number
  height: number
  clipped: boolean
  clipId: string
  width: number
  showLabels: boolean
  palette: JBrowsePalette
}) {
  if (arcs.length === 0) {
    return null
  }
  const body = (
    <>
      {arcs.map(arc => (
        <path
          key={sashimiArcKey(arc)}
          d={arc.d}
          stroke={sashimiArcColor(arc.strand, palette.alignmentFill)}
          strokeWidth={arc.strokeWidth}
          fill="none"
        />
      ))}
      <SashimiArcLabels arcs={arcs} show={showLabels} palette={palette} />
    </>
  )
  return (
    <g transform={`translate(0,${top})`}>
      {clipped ? (
        <SvgClipRect id={clipId} width={width} height={height}>
          {body}
        </SvgClipRect>
      ) : (
        body
      )}
    </g>
  )
}

// Static sashimi arcs for SVG export: the on-screen geometry without the hover
// and selection. The palette is the export theme's, not the live session's.
//
// Not an observer: this draws into a figure `useViewSvgFigure` freezes with a
// `memo`, which does not hold an observer still, and a subscription re-derived
// the band tops from the live scroll while the pileup stayed put.
export default function SashimiArcsSvg({
  model,
  width,
  palette,
}: {
  model: LinearAlignmentsDisplayModel
  width: number
  palette: JBrowsePalette
}) {
  const scroll = model.scrollModel
  const nodeId = svgNodeId(model)
  return model.sashimiArcSections.flatMap(section =>
    SASHIMI_SIDES.map(side => {
      const band = sashimiSideBand(section, side, model.bandHeights)
      return (
        <SashimiSide
          key={`${section.groupKey}-${side}`}
          arcs={section[side]}
          top={bandScreenTop(band.top, scroll)}
          height={band.height}
          clipped={band.clipped}
          clipId={`sashimi-${side}-${section.groupKey}-${nodeId}`}
          width={width}
          showLabels={model.showSashimiLabels}
          palette={palette}
        />
      )
    }),
  )
}
