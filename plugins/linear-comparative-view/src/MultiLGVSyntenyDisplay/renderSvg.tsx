import type React from 'react'

import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { when } from 'mobx'

import { drawSyntenyToCtx } from './components/Canvas2DMultiSyntenyRenderer.ts'

import type { MultiLGVSyntenyDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: MultiLGVSyntenyDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  await when(
    () => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge,
  )

  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }

  const palette = model.colorPalette
  const baseState = model.syntenyRenderState
  if (!palette || !baseState || model.rpcDataMap.size === 0) {
    return null
  }

  const totalWidth = view.totalWidthPx
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const state = { ...baseState, canvasWidth: totalWidth }

  const syntenyNode = paintLayer(totalWidth, model.height, opts, ctx => {
    drawSyntenyToCtx(
      ctx,
      { rpcDataMap: model.rpcDataMap, gpuProps: model.gpuProps(), palette },
      renderBlocks,
      state,
    )
  })

  const { coverageTicks } = model

  return (
    <>
      <SvgClipRect
        id={`multi-synteny-clip-${model.id}`}
        width={view.width}
        height={model.height}
      >
        {syntenyNode}
      </SvgClipRect>
      {model.showCoverage && coverageTicks ? (
        <g transform={`translate(${Math.max(-view.offsetPx, 0)})`}>
          <YScaleBar ticks={coverageTicks} orientation="left" />
        </g>
      ) : null}
    </>
  )
}
