/* eslint-disable react-refresh/only-export-components */
import { SvgColorLegend, legendEntries } from '@jbrowse/core/ui'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import {
  SvgClusterProvenanceCaption,
  SvgTreePath,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { ONSCREEN_AXIS_LEFT_PX } from '@jbrowse/wiggle-core'

import { drawWiggleToCtx } from '../shared/Canvas2DWiggleRenderer.ts'
import {
  WiggleFamilySvgFrame,
  svgLegendRightPx,
  svgScalebarLeftPx,
} from '../shared/WiggleFamilySvg.tsx'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import MultiWiggleOverlayLines from './MultiWiggleOverlayLines.tsx'
import MultiWiggleSvgScales, {
  scoreLegendReservedPx,
} from './MultiWiggleSvgScales.tsx'

import type { ScoreRamp } from '../shared/ScoreLegend.tsx'
import type { WiggleGpuProps } from '../shared/buildSourceRenderData.ts'
import type { WigglePlotGeometry } from '../shared/wiggleDisplayViews.ts'
import type { LegendItem } from '@jbrowse/core/ui'
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
  YScaleTicks,
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

  // read by MultiWiggleSvgScales (row labels, per-row axes, score legend)
  sources: {
    name: string
    label?: string
    color?: string
    labelColor?: string
    group?: string
  }[]
  // the color key, already collapsed and color-resolved by the model — never
  // rebuilt from `sources` here, so the export can't key a different list than
  // the one `overlayLegendApplies` counted
  legendItems: LegendItem[]
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
  showRowLabels: boolean
  showCrossHatches: boolean

  // the overlay color key, which reads `hasOverlayLegend` so a dismissed legend
  // stays out of the export too
  hasOverlayLegend: boolean
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, MultiWiggleSvgBody)
}

function MultiWiggleSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model, view, height, canvasWidth } = props
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
  // The per-row axes are left-oriented, so what each one needs is a clear strip
  // to its LEFT for its ticks and numbers. With no dendrogram that strip is the
  // export's own margin, which is why this normally anchors at the content's
  // left edge and lets the numbers run out past it. **A reserved gutter sits
  // between the two**, so the margin is no longer reachable and an axis anchored
  // there draws its spine down the full height of the tree panel — which is
  // what the export did, while the screen put the same axis in its own strip
  // past the gutter. Same strip, same width, because the numbers it has to
  // clear are the same numbers.
  const scalebarLeft = labelOffset
    ? labelOffset + ONSCREEN_AXIS_LEFT_PX
    : svgScalebarLeftPx(view)

  const gpuProps = model.gpuProps()
  const legendRight = svgLegendRightPx(view, canvasWidth)
  const legendTop = scoreLegendReservedPx(model)

  return (
    <WiggleFamilySvgFrame
      {...props}
      clipIdPrefix="wiggle"
      plotGeometry={model.plotGeometry}
      paint={(ctx, { canvasWidth: w, drawHeight, renderBlocks }) => {
        drawWiggleToCtx(
          ctx,
          {
            rpcDataMap,
            encode: data => buildSourceRenderData(data, gpuProps),
          },
          renderBlocks,
          { ...renderState, canvasWidth: w, canvasHeight: drawHeight },
        )
      }}
      /* Row separators and per-row Y-scale cross-hatches, shared with the
         on-screen path so an exported SVG matches the track when either is
         enabled. Takes the frame's hatch slot, since these ARE the hatches. */
      crossHatches={
        <MultiWiggleOverlayLines model={model} width={canvasWidth} />
      }
      legend={
        <>
          <MultiWiggleSvgScales
            model={model}
            legendRight={legendRight}
            scalebarLeft={scalebarLeft}
            labelOffset={labelOffset}
          />
          {/* The color key, drawn inline here; on screen the same `legendItems`
              go to `FloatingLegend` instead (which portals above the
              inter-region masks the flat export SVG doesn't have). Both read
              `hasOverlayLegend`, so a dismissed legend stays out of the export,
              and both push it below the score legend by the same
              `scoreLegendReservedPx`. */}
          {model.hasOverlayLegend ? (
            <g transform={`translate(0 ${legendTop})`}>
              <SvgColorLegend
                entries={legendEntries({ items: model.legendItems })}
                canvasWidth={legendRight}
                maxHeight={height - legendTop}
                testid="multiwiggle-color-legend"
              />
            </g>
          ) : null}
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
