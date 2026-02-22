import { getContainingView } from '@jbrowse/core/util'

import RectBg from './components/RectBg.tsx'
import SvgTree from './components/SvgTree.tsx'
import LegendBar from '../shared/components/MultiSampleVariantLegendBar.tsx'

import type { LegendBarModel } from './components/types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface Model extends LegendBarModel {
  hierarchy: any
  availableHeight: number
  totalHeight: number
  treeAreaWidth: number
}

export async function makeSidebarSvg(self: Model) {
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  const { hierarchy, showTree, treeAreaWidth, availableHeight } = self

  return (
    <g
      id="tree-layer"
      data-testid="tree-layer"
      transform={`translate(${Math.max(-offsetPx, 0)})`}
      clipPath="url(#sidebarClip)"
    >
      <clipPath id="sidebarClip">
        <rect x="0" y="0" width="100%" height={availableHeight} />
      </clipPath>
      <g
        id="legend-layer"
        transform={`translate(${showTree && hierarchy ? treeAreaWidth : 0})`}
      >
        <LegendBar model={self} orientation="left" exportSVG />
      </g>
      {showTree && hierarchy ? (
        <>
          <RectBg x={0} y={0} width={treeAreaWidth} height={availableHeight} />
          <SvgTree model={self} />
        </>
      ) : null}
    </g>
  )
}
