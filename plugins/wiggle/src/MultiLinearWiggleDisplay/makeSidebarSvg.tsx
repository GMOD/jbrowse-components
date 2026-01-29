import { getContainingView } from '@jbrowse/core/util'

import MultiWiggleLegendBar from './components/MultiWiggleLegendBar.tsx'
import SvgTree from './components/SvgTree.tsx'

import type { LegendBarModel } from './components/treeTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface Model extends LegendBarModel {
  hierarchy: any
  totalHeight: number
  treeAreaWidth: number
  isMultiRow: boolean
}

export async function makeSidebarSvg(self: Model) {
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  const { hierarchy, showTree, treeAreaWidth, height, isMultiRow } = self

  if (!isMultiRow) {
    return null
  }

  return (
    <g
      id="tree-layer"
      data-testid="tree-layer"
      transform={`translate(${Math.max(-offsetPx, 0)})`}
      clipPath="url(#sidebarClip)"
    >
      <clipPath id="sidebarClip">
        <rect x="0" y="0" width="100%" height={height} />
      </clipPath>
      <g
        id="legend-layer"
        transform={`translate(${showTree && hierarchy ? treeAreaWidth : 0})`}
      >
        <MultiWiggleLegendBar model={self} orientation="left" exportSVG />
      </g>
      {showTree && hierarchy ? <SvgTree model={self} /> : null}
    </g>
  )
}
