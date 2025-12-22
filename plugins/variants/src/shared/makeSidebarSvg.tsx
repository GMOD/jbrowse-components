import { getContainingView } from '@jbrowse/core/util'

import SvgTree from './components/SvgTree'
import LegendBar from '../shared/components/MultiVariantLegendBar'

import type { LegendBarModel } from './components/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface Model extends LegendBarModel {
  hierarchy: any
  totalHeight: number
  treeAreaWidth: number
}

export async function makeSidebarSvg(self: Model) {
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  const { hierarchy, treeAreaWidth } = self as any
  return (
    <g id="tree-layer" transform={`translate(${Math.max(-offsetPx, 0)})`}>
      <g
        id="legend-layer"
        transform={`translate(${hierarchy ? treeAreaWidth : 0})`}
      >
        <LegendBar model={self} orientation="left" exportSVG />
      </g>
      <SvgTree model={self} />
    </g>
  )
}
