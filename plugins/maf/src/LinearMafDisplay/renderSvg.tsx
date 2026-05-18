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

import type { VisibleLabel } from './components/computeVisibleLabels.ts'
import type {
  MafGPURenderState,
  MafRpcDataEntry,
} from '../LinearMafRenderer/mafBackendTypes.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { ObservableMap } from 'mobx'

// Duck-typed contract — every field renderSvg actually touches. Lets the
// state model's `.actions(self => …)` block pass `self` here without a cast.
interface RenderSvgSelf extends IAnyStateTreeNode {
  rpcDataMap: ObservableMap<number, MafRpcDataEntry>
  error: unknown
  height: number
  mafRenderState: MafGPURenderState | undefined
  visibleLabels: VisibleLabel[]
}

export async function renderSvg(
  self: RenderSvgSelf,
  opts: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(self) as LinearGenomeViewModel
  await when(() => !!self.error || self.mafRenderState !== undefined)

  if (self.error) {
    return (
      <SVGErrorBox
        error={self.error}
        width={view.width}
        height={self.height}
      />
    )
  }

  const state = self.mafRenderState
  if (!state) {
    return null
  }

  const theme = createJBrowseTheme(opts.theme)
  const totalWidth = view.totalWidthPx
  const displayHeight = self.height
  const svgState = {
    ...state,
    canvasWidth: totalWidth,
    canvasHeight: displayHeight,
  }
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const contrastForBase = getContrastBaseMap(theme)
  const mafNode = paintLayer(totalWidth, displayHeight, opts, ctx => {
    drawMafBlocks(ctx, self.rpcDataMap, renderBlocks, svgState, theme)
    drawMafLabels(
      ctx,
      self.visibleLabels,
      contrastForBase,
      state.mismatchRendering,
    )
  })

  return (
    <SvgClipRect
      id={`maf-clip-${self.id}`}
      width={view.width}
      height={displayHeight}
    >
      {mafNode}
    </SvgClipRect>
  )
}
