import React from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

// locals
import LegendBar from '../shared/LegendBar'

import type { MultiLinearVariantMatrixDisplayModel } from './model'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  self: MultiLinearVariantMatrixDisplayModel,
  opts: ExportSvgDisplayOptions,
  superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  await when(() => !!self.regionCannotBeRenderedText)
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  return (
    <>
      <g>{await superRenderSvg(opts)}</g>
      <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
        <LegendBar model={self} orientation="left" exportSVG />
      </g>
    </>
  )
}
