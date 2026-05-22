import React from 'react'

import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, SvgTreePath } from '@jbrowse/tree-sidebar'
import { when } from 'mobx'

import { drawMafBlocks } from '../LinearMafRenderer/drawMafBlocks.ts'
import { drawMafLabels } from '../LinearMafRenderer/rendering/labels.ts'
import {
  getContrastBaseMap,
  getMafColorPalette,
} from '../LinearMafRenderer/util.ts'

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
  await when(() => !!model.error || model.renderState !== undefined)

  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }

  const state = model.renderState
  if (!state) {
    return null
  }

  const theme = createJBrowseTheme(opts.theme)
  const width = view.totalWidthPx
  const height = model.height
  const { hierarchy, showTree, treeAreaWidth, sources, rowHeight } = model
  const treeShowing = showTree && !!hierarchy
  const labelOffset = treeShowing ? treeAreaWidth : 0
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  // SVG export builds its palette from the user-selected export theme, not
  // the live on-screen palette, so light/dark export choices stay consistent.
  const svgState = {
    ...state,
    canvasWidth: width,
    canvasHeight: height,
    palette: getMafColorPalette(theme),
  }
  const contrast = getContrastBaseMap(theme)

  return (
    <SvgClipRect id={`maf-clip-${model.id}`} width={view.width} height={height}>
      {paintLayer(width, height, opts, ctx => {
        drawMafBlocks(ctx, model.rpcDataMap, renderBlocks, svgState)
        drawMafLabels(
          ctx,
          model.visibleLabels,
          contrast,
          state.mismatchRendering,
        )
      })}
      {treeShowing ? <SvgTreePath hierarchy={hierarchy} /> : null}
      {sources?.length ? (
        <SvgRowLabels
          sources={sources}
          rowHeight={rowHeight}
          labelOffset={labelOffset}
        />
      ) : null}
    </SvgClipRect>
  )
}
