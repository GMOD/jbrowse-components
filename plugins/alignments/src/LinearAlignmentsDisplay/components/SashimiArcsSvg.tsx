import { observer } from 'mobx-react'

import SashimiArcLabels from './SashimiArcLabels.tsx'
import { SASHIMI_SIDES, sashimiArcKey, sashimiSideTop } from './sashimiArcs.ts'
import { bandScreenTop } from './sectionScreen.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

// One side's arcs translated to its sub-band's content-space top. Arc geometry
// is already band-local, so a single translate places the whole side. Paths
// first, labels second, so a count is never buried under a neighbouring arc's
// stroke.
function SashimiSide({
  arcs,
  top,
  showLabels,
  palette,
}: {
  arcs: SashimiArc[]
  top: number
  showLabels: boolean
  palette: JBrowsePalette
}) {
  return arcs.length ? (
    <g transform={`translate(0,${top})`}>
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
    </g>
  ) : null
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
const SashimiArcsSvg = observer(function SashimiArcsSvg({
  model,
  palette,
}: {
  model: LinearAlignmentsDisplayModel
  palette: JBrowsePalette
}) {
  const scroll = model.scrollModel
  return model.sashimiArcSections.flatMap(section =>
    SASHIMI_SIDES.map(side => (
      <SashimiSide
        key={`${section.groupKey}-${side}`}
        arcs={section[side]}
        top={bandScreenTop(sashimiSideTop(section, side), scroll)}
        showLabels={model.showSashimiLabels}
        palette={palette}
      />
    )),
  )
})

export default SashimiArcsSvg
