import {
  getContainingView,
  getSerializedSvg,
  renderToAbstractCanvas,
} from '@jbrowse/core/util'

import SvgTree from './components/SvgTree'
import LegendBar from '../shared/components/MultiVariantLegendBar'

import type { LegendBarModel } from './components/types'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import { drawTree } from './drawTree'

interface Model extends LegendBarModel {
  hierarchy: any
  availableHeight: number
  totalHeight: number
  treeAreaWidth: number
}

export async function makeSidebarSvg(
  self: Model,
  opts: ExportSvgDisplayOptions,
) {
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  const { hierarchy, showTree, treeAreaWidth, availableHeight } = self
  const { totalHeight } = self as any

  console.log({ opts })
  let treeSvg = null
  if (hierarchy) {
    const result = await renderToAbstractCanvas(
      treeAreaWidth,
      totalHeight,
      {
        exportSVG: opts,
      },
      async ctx => {
        drawTree({
          ctx,
          model: self,
        })
        return undefined
      },
    )

    if ('html' in result) {
      treeSvg = <g dangerouslySetInnerHTML={{ __html: result.html }} />
    } else if ('canvasRecordedData' in result) {
      const html = await getSerializedSvg({
        width: treeAreaWidth,
        height: totalHeight,
        canvasRecordedData: result.canvasRecordedData,
      })
      treeSvg = <g dangerouslySetInnerHTML={{ __html: html }} />
    }
  }

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
      {showTree ? treeSvg : null}
    </g>
  )
}
