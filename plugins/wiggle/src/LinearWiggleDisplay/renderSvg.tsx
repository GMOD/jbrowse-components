import type React from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { when } from 'mobx'

import { buildSourceRenderData } from './components/buildSourceRenderData.ts'
import DensityLegend from '../shared/DensityLegend.tsx'
import { paintHeadlessWiggle } from '../shared/paintHeadlessWiggle.ts'

import type { LinearWiggleDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: LinearWiggleDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  await when(
    () => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge,
  )
  const { offsetPx } = view
  // anchors scale bars to left edge of content; non-zero only when scrolled before genome start
  const scalebarLeft = Math.max(-offsetPx, 0)
  const height = model.height
  const { ticks, rpcDataMap, domain, renderState } = model

  if (model.error) {
    return (
      <SVGErrorBox error={model.error} width={view.width} height={height} />
    )
  }

  if (rpcDataMap.size === 0 || !domain || !renderState) {
    return null
  }

  let legendEl: React.ReactNode = null
  if (model.isDensityMode) {
    legendEl = (
      <DensityLegend
        domain={domain}
        scaleType={model.scaleType}
        canvasWidth={view.width}
      />
    )
  } else if (ticks) {
    legendEl = (
      <g transform={`translate(${scalebarLeft})`}>
        <YScaleBar ticks={ticks} orientation="left" />
      </g>
    )
  }

  const props = model.gpuProps()
  const wiggleNode = paintHeadlessWiggle({
    view,
    height,
    rpcDataMap,
    encode: data => buildSourceRenderData(data, props),
    renderState,
    opts,
  })

  if (opts?.rasterizeLayers) {
    return (
      <>
        {wiggleNode}
        {legendEl}
      </>
    )
  }

  return (
    <>
      <SvgClipRect
        id={`wiggle-clip-${model.id}`}
        width={view.width}
        height={height}
      >
        {wiggleNode}
      </SvgClipRect>
      {legendEl}
    </>
  )
}
