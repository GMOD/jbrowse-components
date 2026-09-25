/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgTreeSidebar, treeSidebarOffset } from '@jbrowse/tree-sidebar'
import { ScorePlotSvgFrame } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'

import { encodeWiggleRegions } from '../shared/buildSourceRenderData.ts'
import { WIGGLE_MARKS } from '../shared/wiggleMarks.ts'
import WiggleRowLabels from './WiggleRowLabels.tsx'
import WiggleRowSeparators from './WiggleRowSeparators.tsx'

import type { WiggleGpuProps } from '../shared/buildSourceRenderData.ts'
import type { WigglePlotGeometry } from '../shared/wiggleDisplayViews.ts'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type {
  ClusterHierarchyNode,
  ClusterProvenance,
} from '@jbrowse/tree-sidebar'
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
  id: string
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
  renderState: WiggleGPURenderState
  gpuProps: () => WiggleGpuProps
  plotGeometry: WigglePlotGeometry

  // the dendrogram and its caption
  showTree: boolean
  treeAreaWidth: number
  hierarchy?: ClusterHierarchyNode
  rowTreeProvenance?: ClusterProvenance

  // read by WiggleRowLabels
  sources: {
    name: string
    label?: string
    color?: string
    labelColor?: string
    group?: string
  }[]
  isOverlay: boolean
  isDensityMode: boolean
  effectiveRowHeight: number
  numSources: number
  numRows: number

  // read by the shell's axes
  axes: YAxis[]
  canvasWidthPx: number
  showCrossHatches: boolean

  // read by WiggleRowSeparators
  showRowSeparators: boolean
  showRowLabels: boolean
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, WiggleSvgBody)
}

function WiggleSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model, view, canvasWidth, overlays } = props
  // No data-size gate: renderState is always defined (a [0,1] stub until
  // autoscale resolves), so an empty region paints an empty plot; the per-row
  // axes are the shell's, off `valueScales`, and draw only where a real domain
  // exists. The row labels are `WiggleRowLabels`, shared with the screen,
  // so the sidebar draws only the tree.
  return (
    <ScorePlotSvgFrame
      {...props}
      plotGeometry={model.plotGeometry}
      marks={WIGGLE_MARKS}
      regions={encodeWiggleRegions(model)}
      renderState={model.renderState}
    >
      {overlays ? (
        <>
          <WiggleRowSeparators model={model} width={canvasWidth} />
          <WiggleRowLabels
            model={model}
            labelOffset={treeSidebarOffset(model)}
            exportContentLeft={Math.max(-view.offsetPx, 0)}
          />
          <SvgTreeSidebar
            showTree={model.showTree}
            showLabels={false}
            hierarchy={model.hierarchy}
            sources={[]}
            rowHeight={model.effectiveRowHeight}
            treeAreaWidth={model.treeAreaWidth}
          />
        </>
      ) : null}
    </ScorePlotSvgFrame>
  )
}
