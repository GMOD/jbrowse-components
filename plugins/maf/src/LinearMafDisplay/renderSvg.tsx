import type React from 'react'

import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import { drawMafBlocks } from '../LinearMafRenderer/drawMafBlocks.ts'
import { drawMafLabels } from '../LinearMafRenderer/rendering/labels.ts'
import { getContrastBaseMap } from '../LinearMafRenderer/util.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  model: LinearMafDisplayModel,
  opts: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LinearGenomeViewModel
  await when(() => !!model.error || model.mafRenderState !== undefined)

  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }

  const state = model.mafRenderState
  if (!state) {
    return null
  }

  const theme = createJBrowseTheme(opts.theme)
  const width = view.totalWidthPx
  const height = model.height
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const svgState = { ...state, canvasWidth: width, canvasHeight: height }
  const contrast = getContrastBaseMap(theme)

  return (
    <SvgClipRect id={`maf-clip-${model.id}`} width={view.width} height={height}>
      {paintLayer(width, height, opts, ctx => {
        drawMafBlocks(ctx, model.rpcDataMap, renderBlocks, svgState, theme)
        drawMafLabels(ctx, model.visibleLabels, contrast, state.mismatchRendering)
      })}
    </SvgClipRect>
  )
}
