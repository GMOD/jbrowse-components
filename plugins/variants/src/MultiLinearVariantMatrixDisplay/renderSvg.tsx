import { getContainingView } from '@jbrowse/core/util'
import {
  getSerializedSvg,
  renderToAbstractCanvas,
} from '@jbrowse/core/util/offscreenCanvasUtils'
import { when } from 'mobx'

import LinesConnectingMatrixToGenomicPosition from './components/LinesConnectingMatrixToGenomicPosition'
import LegendBar from '../shared/components/MultiVariantLegendBar'
import { drawTree } from '../shared/components/drawTree'

import type { MultiLinearVariantMatrixDisplayModel } from './model'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  model: MultiLinearVariantMatrixDisplayModel,
  opts: ExportSvgDisplayOptions,
  superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  await when(() => !!model.regionCannotBeRenderedText)
  const { offsetPx } = getContainingView(model) as LinearGenomeViewModel
  const { lineZoneHeight, hierarchy, treeAreaWidth, totalHeight } = model as any

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
      <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
        <LinesConnectingMatrixToGenomicPosition exportSVG model={model} />
        <g transform={`translate(0,${lineZoneHeight})`}>
          <g>{await superRenderSvg(opts)}</g>
          <g transform={`translate(${hierarchy ? treeAreaWidth : 0})`}>
            <LegendBar model={model} orientation="left" exportSVG />
          </g>
          {treeSvg}
        </g>
      </g>
    </>
  )
}
