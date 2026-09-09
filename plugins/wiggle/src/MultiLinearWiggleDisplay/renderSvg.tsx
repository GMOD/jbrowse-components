/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import {
  SvgClusterProvenanceCaption,
  SvgTreePath,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'

import { WiggleFamilySvgFrame } from '../shared/WiggleFamilySvg.tsx'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import { WIGGLE_MARKS } from '../shared/wiggleMarks.ts'
import MultiWiggleRowLabels from './MultiWiggleRowLabels.tsx'
import MultiWiggleRowSeparators from './MultiWiggleRowSeparators.tsx'

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
  SourceRenderData,
  WiggleDataResult,
  WiggleGPURenderState,
  YAxis,
} from '@jbrowse/wiggle-core'
import type React from 'react'

/**
 * What the export reads off the display — spelled out rather than taking the
 * concrete model, which is the convention `renderDisplaySvg` documents and what
 * keeps this path testable without standing up MST and a fetch lifecycle. It is
 * deliberately not the component contract (`MultiWiggleDisplayModel`): that one
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
  clusterProvenance?: ClusterProvenance

  // read by MultiWiggleRowLabels
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

  // read by MultiWiggleRowSeparators
  showRowSeparators: boolean
  showRowLabels: boolean
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, MultiWiggleSvgBody)
}

function MultiWiggleSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model, canvasWidth } = props
  const { rpcDataMap, renderState } = model

  // No data-size gate: renderState is always defined (a [0,1] stub until
  // autoscale resolves), so an empty region paints an empty plot; the per-row
  // axes are the shell's, off `valueScales`, and draw only where a real domain
  // exists. Wiggle can't use the shared SvgTreeSidebar: its row labels live in
  // MultiWiggleRowLabels (shared with the on-screen path). So keep the split,
  // but derive the label offset and the tree from the one `treeSidebarOffset`
  // gate so a blank gutter can't appear.
  const { hierarchy } = model
  const labelOffset = treeSidebarOffset(model)

  const gpuProps = model.gpuProps()

  return (
    <WiggleFamilySvgFrame
      {...props}
      clipIdPrefix="wiggle"
      plotGeometry={model.plotGeometry}
      paint={(ctx, { canvasWidth: w, drawHeight, renderBlocks }) => {
        const regions = new Map<number, SourceRenderData[]>()
        for (const [idx, data] of rpcDataMap) {
          regions.set(idx, buildSourceRenderData(data, gpuProps))
        }
        paintMarkBlocks(ctx, WIGGLE_MARKS, regions, renderBlocks, {
          ...renderState,
          canvasWidth: w,
          canvasHeight: drawHeight,
        })
      }}
      overlay={<MultiWiggleRowSeparators model={model} width={canvasWidth} />}
      legend={
        <>
          <MultiWiggleRowLabels model={model} labelOffset={labelOffset} />
          {labelOffset && hierarchy ? (
            <>
              <SvgTreePath hierarchy={hierarchy} />
              {/* The same caption component `SvgTreeSidebar` draws for the
                  displays that can use that wrapper — see there for why this
                  display can't, and there for the caption's own rationale. */}
              <SvgClusterProvenanceCaption
                clusterProvenance={model.clusterProvenance}
              />
            </>
          ) : null}
        </>
      }
    />
  )
}
