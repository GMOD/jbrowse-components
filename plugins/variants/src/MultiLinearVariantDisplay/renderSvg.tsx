import { getContainingView } from '@jbrowse/core/util'
import {
  getSerializedSvg,
  renderToAbstractCanvas,
} from '@jbrowse/core/util/offscreenCanvasUtils'
import { when } from 'mobx'

import LegendBar from '../shared/components/MultiVariantLegendBar'
import { drawTree } from '../shared/components/drawTree'

import type { MultiLinearVariantDisplayModel } from './model'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  self: MultiLinearVariantDisplayModel,
  opts: ExportSvgDisplayOptions,
  superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  await when(() => !!self.regionCannotBeRenderedText)
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  const { hierarchy, treeAreaWidth, totalHeight } = self as any
  const dataSvg = await superRenderSvg(opts)

  let treeSvg = null
  if (hierarchy) {
    const result = await renderToAbstractCanvas(
      treeAreaWidth,
      totalHeight,
      { exportSVG: { rasterizeLayers: opts.rasterizeLayers } },
      async ctx => {
        drawTree(ctx, hierarchy, treeAreaWidth, totalHeight)
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
    <>
      <g id="data-layer">{dataSvg}</g>
      <g id="tree-layer" transform={`translate(${Math.max(-offsetPx, 0)})`}>
        <g
          id="legend-layer"
          transform={`translate(${hierarchy ? treeAreaWidth : 0})`}
        >
          <LegendBar model={self} orientation="left" exportSVG />
        </g>
        {treeSvg}
      </g>
    </>
  )
}
