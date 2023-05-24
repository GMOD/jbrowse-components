import React from 'react'
import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'
import YScaleBar from '../../shared/YScaleBar'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { WiggleDisplayModel } from './model'

export async function renderSvg(
  self: any,
  opts: any,
  superRenderSvg: (opts: any) => Promise<React.ReactNode>,
) {
  await when(() => !!self.stats && !!self.regionCannotBeRenderedText)
  const { needsScalebar, stats } = self
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  return (
    <>
      <g id="snpcov">{await superRenderSvg(opts)}</g>
      {needsScalebar && stats ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <YScaleBar model={self as WiggleDisplayModel} orientation="left" />
        </g>
      ) : null}
    </>
  )
}
