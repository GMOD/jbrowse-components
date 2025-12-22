import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

import LinesConnectingMatrixToGenomicPosition from './components/LinesConnectingMatrixToGenomicPosition'
import { makeSidebarSvg } from '../shared/makeSidebarSvg'

import type { MultiLinearVariantMatrixDisplayModel } from './model'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  model: MultiLinearVariantMatrixDisplayModel,
  opts: ExportSvgDisplayOptions,
  superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  await when(() => !!model.regionCannotBeRenderedText)
  const { offsetPx } = getContainingView(model) as LinearGenomeViewModel
  const { lineZoneHeight } = model

  return (
    <>
      <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
        <LinesConnectingMatrixToGenomicPosition exportSVG model={model} />
        <g transform={`translate(0,${lineZoneHeight})`}>
          <g>{await superRenderSvg(opts)}</g>
          {await makeSidebarSvg(model)}
        </g>
      </g>
    </>
  )
}
