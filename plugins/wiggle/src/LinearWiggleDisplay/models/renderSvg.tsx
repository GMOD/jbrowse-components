import React from 'react'
import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'
import YScaleBar from '../../shared/YScaleBar'
import {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import { WiggleDisplayModel } from './model'

export async function renderSvg(
  self: WiggleDisplayModel,
  opts: ExportSvgDisplayOptions,
  superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  await when(() => !!self.stats && !!self.regionCannotBeRenderedText)
  const { needsScalebar, stats } = self
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  return (
    <>
      <g id="snpcov">{await superRenderSvg(opts)}</g>
      {needsScalebar && stats ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <YScaleBar model={self} orientation="left" />
        </g>
      ) : null}
    </>
  )
}
