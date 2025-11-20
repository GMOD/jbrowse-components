import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

import YScaleBar from '../shared/YScaleBar'

import type { WiggleDisplayModel } from './model'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  self: WiggleDisplayModel,
  opts: ExportSvgDisplayOptions,
  superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  await when(
    () =>
      (!!self.stats && !!self.regionCannotBeRenderedText) ||
      !!(self as { error?: unknown }).error,
  )
  const { graphType, stats } = self
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  return (
    <>
      <g>{await superRenderSvg(opts)}</g>
      {graphType && stats ? (
        <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
          <YScaleBar model={self} orientation="left" />
        </g>
      ) : null}
    </>
  )
}
