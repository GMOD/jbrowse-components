import { getContainingView } from '@jbrowse/core/util'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { when } from 'mobx'

import { isReadyOrHasError } from '../svgExportUtil.ts'

import type { WiggleDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  self: WiggleDisplayModel,
  opts: ExportSvgDisplayOptions,
  superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  await when(() => isReadyOrHasError(self))
  const { graphType, stats } = self
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  return (
    <>
      <g>{await superRenderSvg(opts)}</g>
      {graphType && stats ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <YScaleBar ticks={self.ticks} orientation="left" />
        </g>
      ) : null}
    </>
  )
}
