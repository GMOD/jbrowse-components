import { getContainingView } from '@jbrowse/core/util'
import { whenReadyOrError } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import YScaleBars from './components/YScaleBars'

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
    whenReadyOrError(
      () => !!self.stats && !!self.regionCannotBeRenderedText,
      self,
    ),
  )
  const { offsetPx } = getContainingView(self) as LinearGenomeViewModel
  return (
    <>
      <g>{await superRenderSvg(opts)}</g>
      <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
        <YScaleBars model={self} orientation="left" exportSVG />
      </g>
    </>
  )
}
