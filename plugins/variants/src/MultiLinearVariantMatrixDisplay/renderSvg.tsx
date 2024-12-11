import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

// locals
import LegendBar from '../shared/LegendBar'
import LinesConnectingMatrixToGenomicPosition from './components/LinesConnectingMatrixToGenomicPosition'

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
  return (
    <>
      <g transform={`translate(${Math.max(-offsetPx, 0)})`}>
        <LinesConnectingMatrixToGenomicPosition exportSVG model={model} />
        <g transform={`translate(0,${model.lineZoneHeight})`}>
          <g>{await superRenderSvg(opts)}</g>
          <LegendBar model={model} orientation="left" exportSVG />
        </g>
      </g>
    </>
  )
}
