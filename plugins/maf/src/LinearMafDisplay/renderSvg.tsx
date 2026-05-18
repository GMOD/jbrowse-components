import React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { drawMafBlocks } from '../LinearMafRenderer/drawMafBlocks.ts'
import { drawMafLabels } from '../LinearMafRenderer/rendering/labels.ts'
import { getContrastBaseMap } from '../LinearMafRenderer/util.ts'

import type {
  MafGPURenderState,
  MafRpcDataEntry,
} from '../LinearMafRenderer/mafBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { ObservableMap } from 'mobx'

// Duck-typed contract — every field renderSvg actually touches. Lets the
// state model's `.actions(self => …)` block pass `self` here without a cast
// (the action's inner `self` type doesn't yet contain the action itself).
interface RenderSvgSelf extends IAnyStateTreeNode {
  rpcDataMap: ObservableMap<number, MafRpcDataEntry>
  error: unknown
  height: number
  mafRenderState: MafGPURenderState | undefined
  renderBlocks: RenderBlock[]
}

export async function renderSvg(
  self: RenderSvgSelf,
  opts: ExportSvgDisplayOptions,
) {
  await when(() => self.rpcDataMap.size > 0 || !!self.error)

  const { width } = getContainingView(self) as LinearGenomeViewModel
  const { height } = self
  const state = self.mafRenderState

  if (!state) {
    return null
  }

  const theme = createJBrowseTheme(opts.theme)
  const svgState = { ...state, canvasWidth: width, canvasHeight: height }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    drawMafBlocks(ctx, self.rpcDataMap, self.renderBlocks, svgState, theme)
    const labels = computeVisibleLabels(self.renderBlocks, self.rpcDataMap, svgState)
    drawMafLabels(ctx, labels, getContrastBaseMap(theme), state.mismatchRendering)
  }
  return <image href={canvas.toDataURL()} width={width} height={height} />
}
