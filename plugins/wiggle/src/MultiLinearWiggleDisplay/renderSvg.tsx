/* eslint-disable react-refresh/only-export-components */
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgClipRect,
  renderDisplaySvg,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import {
  SvgTreePath,
  describeClusterProvenance,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'

import { drawWiggleToCtx } from '../shared/Canvas2DWiggleRenderer.ts'
import OverlayColorLegend from '../shared/OverlayColorLegend.tsx'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import { legendRightEdgePx } from '../shared/wiggleComponentUtils.ts'
import MultiWiggleOverlayLines from './MultiWiggleOverlayLines.tsx'
import MultiWiggleSvgScales from './MultiWiggleSvgScales.tsx'

import type { ScoreRamp } from '../shared/ScoreLegend.tsx'
import type { WiggleGpuProps } from '../shared/buildSourceRenderData.ts'
import type { WiggleDataResult } from '../util.ts'
import type {
  ExportSvgDisplayOptions,
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/plugin-linear-genome-view'
import type {
  ClusterHierarchyNode,
  ClusterProvenance,
} from '@jbrowse/tree-sidebar'
import type { WiggleGPURenderState, YScaleTicks } from '@jbrowse/wiggle-core'
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

  // the dendrogram and its caption
  showTree: boolean
  treeAreaWidth: number
  hierarchy?: ClusterHierarchyNode
  clusterProvenance?: ClusterProvenance

  // read by MultiWiggleSvgScales (row labels, per-row axes, score legend)
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
  domain: [number, number] | undefined
  scaleType: string
  ticks?: YScaleTicks
  rowHeightTooSmallForScalebar: boolean
  numSources: number
  numRows: number
  scoreRamp: ScoreRamp | undefined

  // read by MultiWiggleOverlayLines
  showRowSeparators: boolean
  showCrossHatches: boolean

  // the overlay color key, which reads `hasOverlayLegend` so a dismissed legend
  // stays out of the export too
  hasOverlayLegend: boolean
  posColor: string
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, MultiWiggleSvgBody)
}

function MultiWiggleSvgBody({
  model,
  view,
  height,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  // anchors scale bars to left edge of content; non-zero only when scrolled
  // before genome start. Left-oriented, so the labels grow into the export
  // margin rather than over the plot (the on-screen axis instead indents by
  // ONSCREEN_AXIS_LEFT_PX and grows rightward).
  const scalebarLeft = Math.max(-view.offsetPx, 0)
  const { rpcDataMap, renderState } = model

  // No data-size gate: renderState is always defined (a [0,1] stub until
  // autoscale resolves), so an empty region paints an empty plot; the per-source
  // scales draw only where a real domain exists (MultiWiggleSvgScales).
  // Wiggle can't use the shared SvgTreeSidebar: its row labels live in
  // MultiWiggleSvgScales (shared with the on-screen path, alongside the
  // scalebars). So keep the split, but derive the label offset and the tree from
  // the one `treeSidebarOffset` gate so a blank gutter can't appear.
  const { hierarchy } = model
  const labelOffset = treeSidebarOffset(model)

  const props = model.gpuProps()
  // right-aligned legends pin to the content's right edge, not the viewport's:
  // at whole-genome zoom the regions can end before it, and a legend parked out
  // in the empty gutter reads as detached from the plot (same rule as on screen)
  const legendRight = legendRightEdgePx(view.visibleRegions, canvasWidth)
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const state = {
    ...renderState,
    canvasWidth,
    canvasHeight: height,
  }

  return (
    <>
      <SvgClipRect
        id={`wiggle-clip-${model.id}`}
        width={canvasWidth}
        height={height}
      >
        <PaintLayer
          width={canvasWidth}
          height={height}
          opts={opts}
          paint={ctx => {
            drawWiggleToCtx(
              ctx,
              {
                rpcDataMap,
                encode: data => buildSourceRenderData(data, props),
              },
              renderBlocks,
              state,
            )
          }}
        />
      </SvgClipRect>
      {/* Row separators and Y-scale cross-hatches, shared with the on-screen
          path so an exported SVG matches the track when either is enabled. */}
      <MultiWiggleOverlayLines model={model} width={canvasWidth} />
      <MultiWiggleSvgScales
        model={model}
        legendRight={legendRight}
        scalebarLeft={scalebarLeft}
        labelOffset={labelOffset}
      />
      {/* Overlay-mode color legend, drawn inline here. On screen this same
          legend is the hoisted MultiWiggleLegendOverlay instead (lifted above
          the inter-region masks, which the flat export SVG doesn't have); both
          read `hasOverlayLegend`, so a dismissed legend stays out of the
          export. */}
      {model.hasOverlayLegend ? (
        <OverlayColorLegend
          sources={model.sources}
          fallbackColor={model.posColor}
          canvasWidth={legendRight}
          maxHeight={height}
        />
      ) : null}
      {labelOffset && hierarchy ? (
        <>
          <SvgTreePath hierarchy={hierarchy} />
          {/* The locus travels with the figure — see SvgTreeSidebar, which
              carries the same caption for the displays that can use it. */}
          {model.clusterProvenance ? (
            <text x={0} y={-4} fontSize={11} fill="#666">
              {describeClusterProvenance(model.clusterProvenance)}
            </text>
          ) : null}
        </>
      ) : null}
    </>
  )
}
