/* eslint-disable react-refresh/only-export-components */
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgClipRect,
  renderDisplaySvg,
} from '@jbrowse/plugin-linear-genome-view'
import { SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import MultiRowColorLegend from './components/MultiRowColorLegend.tsx'
import MultiRowSeparatorLines from './components/MultiRowSeparatorLines.tsx'
import { drawMultiRowBlocks } from './rendering/drawMultiRowBlocks.ts'
import { drawMultiRowIndelGlyphs } from './rendering/drawMultiRowIndelGlyphs.ts'

import type { LegendEntry } from './rendering/colorLegend.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { MultiRowSource } from './sourcesLogic.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type {
  ExportSvgDisplayOptions,
  LgvSvgBodyProps,
} from '@jbrowse/plugin-linear-genome-view'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type {
  ClusterProvenance,
  ClusterHierarchyNode,
} from '@jbrowse/tree-sidebar'

// Duck-typed slice of the display the export reads, mirroring
// LinearBasicDisplay's RenderSvgModel: it decouples renderSvg from the full MST
// model (so it's unit-testable with a plain object) and makes the export's data
// dependencies explicit.
export interface RenderSvgModel extends SvgExportable {
  id: string
  height: number
  rpcDataMap: { get: (key: number) => MultiRowRegionData | undefined }
  renderBlocks: RenderBlock[]
  renderState: MultiRowRenderState
  sources: MultiRowSource[]
  effectiveRowHeight: number
  treeAreaWidth: number
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
  // Captioned above the exported tree — for this display it also records the
  // color scheme, which IS the clustering matrix here.
  clusterProvenance?: ClusterProvenance
  showLegend: boolean
  showRowSeparators: boolean
  showRowLabels: boolean
  colorLegend: LegendEntry[]
  hiddenCategorySet: ReadonlySet<string>
}

export async function renderSvg(
  self: RenderSvgModel,
  opts: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(self, opts, MultiRowSvgBody)
}

function MultiRowSvgBody({
  model: self,
  height,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  return (
    <>
      <SvgClipRect
        id={`multirow-clip-${self.id}`}
        width={canvasWidth}
        height={height}
      >
        <PaintLayer
          width={canvasWidth}
          height={height}
          opts={opts}
          paint={ctx => {
            const state = {
              ...self.renderState,
              // canvasWidth is the block scissor bound, so it has to be the
              // width this layer is actually painted at — see
              // LgvSvgBodyProps.canvasWidth.
              canvasWidth,
              canvasHeight: height,
            }
            drawMultiRowBlocks(ctx, self.rpcDataMap, self.renderBlocks, state)
            // Same layer, after the blocks, so the export stacks them the way
            // the on-screen overlay composites over the canvas.
            drawMultiRowIndelGlyphs(
              ctx,
              self.rpcDataMap,
              self.renderBlocks,
              state,
              // From the user-selected export theme rather than the live
              // on-screen palette, so a light export of a dark session stays
              // light — plugin-maf's rule for the same glyph.
              resolvePalette({ configTheme: opts?.theme }).insertion,
            )
          }}
        />
      </SvgClipRect>
      {/* before the sidebar, matching the live display's stacking: the tree
          panel paints over the lines rather than the lines over the tree */}
      {self.showRowSeparators ? (
        <MultiRowSeparatorLines
          numRows={self.sources.length}
          rowHeight={self.effectiveRowHeight}
          width={canvasWidth}
        />
      ) : null}
      <SvgTreeSidebar
        showTree={self.showTree}
        showLabels={self.showRowLabels}
        hierarchy={self.hierarchy}
        sources={self.sources}
        rowHeight={self.effectiveRowHeight}
        treeAreaWidth={self.treeAreaWidth}
        availableHeight={height}
        clusterProvenance={self.clusterProvenance}
      />
      {self.showLegend && self.colorLegend.length ? (
        <MultiRowColorLegend
          entries={self.colorLegend}
          canvasWidth={canvasWidth}
          maxHeight={height}
          hiddenLabels={self.hiddenCategorySet}
        />
      ) : null}
    </>
  )
}
