import { whenReadyOrAnyError } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

interface SubDisplay {
  height: number
  error?: unknown
  renderSvg(opts: ExportSvgDisplayOptions): Promise<React.ReactNode>
}

interface MinimalLinearAlignmentsDisplay {
  height: number
  SNPCoverageDisplay: SubDisplay
  PileupDisplay: SubDisplay
  notReady(): boolean
}

export async function renderSvg(
  self: MinimalLinearAlignmentsDisplay,
  opts: ExportSvgDisplayOptions,
) {
  const pileupHeight = self.height - self.SNPCoverageDisplay.height
  await when(
    whenReadyOrAnyError(
      () => !self.notReady(),
      self.SNPCoverageDisplay,
      self.PileupDisplay,
    ),
  )
  return (
    <>
      <g>{await self.SNPCoverageDisplay.renderSvg(opts)}</g>
      <g transform={`translate(0 ${self.SNPCoverageDisplay.height})`}>
        {await self.PileupDisplay.renderSvg({
          ...opts,
          overrideHeight: pileupHeight,
        })}
      </g>
    </>
  )
}
