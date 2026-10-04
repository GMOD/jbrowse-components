/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgTreeSidebar } from '@jbrowse/tree-sidebar'
import { ScorePlotSvgFrame } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'

import { encodeWiggleRegions } from '../shared/buildSourceRenderData.ts'
import { WIGGLE_MARKS } from '../shared/wiggleMarks.ts'
import { wiggleRowSeparators } from './WiggleRowSeparators.tsx'

import type { WiggleGpuProps } from '../shared/buildSourceRenderData.ts'
import type { WigglePlotGeometry } from '../shared/wiggleDisplayViews.ts'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { SvgSidebarProps } from '@jbrowse/tree-sidebar'
import type {
  WiggleDataResult,
  WiggleGPURenderState,
  YAxis,
} from '@jbrowse/wiggle-core'
import type React from 'react'

/**
 * What the export reads off the display — spelled out rather than taking the
 * concrete model, which is the convention `renderDisplaySvg` documents and what
 * keeps this path testable without standing up MST and a fetch lifecycle. It is
 * deliberately not the component contract (`WiggleDisplayModel`): that one
 * also carries the canvas refs and hover setters an export has no use for.
 */
export interface RenderSvgModel extends LgvSvgExportable {
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
  renderState: WiggleGPURenderState
  gpuProps: () => WiggleGpuProps
  plotGeometry: WigglePlotGeometry

  svgSidebar: SvgSidebarProps

  // read by the shell's axes
  axes: YAxis[]
  canvasWidthPx: number

  // read by wiggleRowSeparators
  isOverlay: boolean
  isDensityMode: boolean
  showRowSeparators: boolean
  effectiveRowHeight: number
  numRows: number
  rowsTopOffset: number
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, WiggleSvgBody)
}

function WiggleSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model, canvasWidth, overlays, opts } = props
  // No data-size gate: renderState is always defined (a [0,1] stub until
  // autoscale resolves), so an empty region paints an empty plot; the per-row
  // axes are the shell's, off `valueScales`, and draw only where a real domain
  // exists.
  return (
    <ScorePlotSvgFrame
      {...props}
      plotGeometry={model.plotGeometry}
      marks={WIGGLE_MARKS}
      regions={encodeWiggleRegions(model)}
      renderState={model.renderState}
    >
      {overlays ? (
        <g transform={`translate(0,${model.rowsTopOffset})`}>
          {wiggleRowSeparators(model, canvasWidth)}
          <SvgTreeSidebar sidebar={model.svgSidebar} text={opts} />
        </g>
      ) : null}
    </ScorePlotSvgFrame>
  )
}
