import { when } from 'mobx'

import { hasAnySubDisplayError } from '../svgExportUtil.ts'

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
  const subDisplays = [self.SNPCoverageDisplay, self.PileupDisplay]
  await when(() => !self.notReady() || hasAnySubDisplayError(subDisplays))
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
