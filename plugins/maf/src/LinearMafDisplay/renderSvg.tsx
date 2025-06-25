import React from 'react'

import { getContainingView } from '@jbrowse/core/util'

import YScaleBars from './components/Sidebar/YScaleBars'

import type { LinearMafDisplayModel } from './stateModel'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  self: LinearMafDisplayModel,
  opts: ExportSvgDisplayOptions,
  superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  const { height, id } = self
  const { offsetPx, width } = getContainingView(self) as LinearGenomeViewModel
  const clipid = `mafclip-${id}`
  return (
    <>
      <defs>
        <clipPath id={clipid}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipid})`}>
        <g id="snpcov">{await superRenderSvg(opts)}</g>
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <YScaleBars model={self} orientation="left" exportSVG />
        </g>
      </g>
    </>
  )
}
