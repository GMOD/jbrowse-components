import React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

import { drawMafBlocks } from '../LinearMafRenderer/drawMafBlocks.ts'
import YScaleBars from './components/Sidebar/YScaleBars.tsx'

import type { LinearMafDisplayModel } from './stateModel.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  self: LinearMafDisplayModel,
  opts: ExportSvgDisplayOptions,
  _superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  await when(() => self.rpcDataMap.size > 0 || !!self.error)

  const view = getContainingView(self) as LinearGenomeViewModel
  const { offsetPx, width } = view
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
  }
  const dataUrl = canvas.toDataURL()

  return (
    <>
      <image href={dataUrl} width={width} height={height} />
      <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
        <YScaleBars model={self} exportSVG />
      </g>
    </>
  )
}
