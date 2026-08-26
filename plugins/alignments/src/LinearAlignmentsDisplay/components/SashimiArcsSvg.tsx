import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'

import SashimiArcLabels from './SashimiArcLabels.tsx'
import { SASHIMI_SIDES, sashimiArcKey, sashimiSideBand } from './sashimiArcs.ts'
import { bandScreenTop } from './sectionScreen.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

// One side's arcs translated to its sub-band's content-space top. Arc geometry
// is already band-local, so a single translate places the whole side. Paths
// first, labels second, so a count is never buried under a neighbouring arc's
// stroke.
//
// `clipped` is `sashimiSideBand`'s, and it is the same box the on-screen band
// applies as `overflow: hidden` — the down strip must not paint over the pileup
// underneath it, whereas the up band stays open so a tall arc can rise into the
// coverage band's own top margin. The export used to draw both sides unclipped,
// so a down band dragged short enough for its arcs' strokes and count labels to
// overrun it produced a figure the screen never showed.
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
          stroke={arc.stroke}
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

// Static sashimi arcs for SVG export — the very same `sashimiArcSections`
// geometry the on-screen overlay renders, minus the hover/click handlers. Band
// tops are content-space and go through `bandScreenTop`, the same projection
// SashimiArcsOverlay uses, so a scrolled export puts the arcs on the reads they
// belong to. (They sat at their raw content tops while the export pinned
// scrollTop to 0.)
//
// The palette is the EXPORT theme's, passed down rather than pulled from
// `usePalette`: the export resolves its own palette (`resolvePalette` in
// renderSvg) so the figure matches the theme the user asked to export in, not
// the live session's.
//
// Not an observer: this draws into a figure `useViewSvgFigure` freezes with a
// `memo`, which does not hold an observer still. Subscribing here re-derived
// `bandScreenTop` from the live scroll while the pileup underneath stayed where
// the snapshot left it. The file export renders in one synchronous pass and
// never needed the subscription.
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
      const band = sashimiSideBand(section, side, model)
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
