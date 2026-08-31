import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { RowSeparatorLines, SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import MultiRowColorLegend from './components/MultiRowColorLegend.tsx'
import { drawMultiRowBlocks } from './rendering/drawMultiRowBlocks.ts'
import { drawMultiRowIndelGlyphs } from './rendering/drawMultiRowIndelGlyphs.ts'
import { SEPARATOR_OPACITY } from './rendering/rowBand.ts'

import type { LegendEntry } from './rendering/colorLegend.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { MultiRowSource } from './sourcesLogic.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { LegendItem } from '@jbrowse/core/ui'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
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
  renderState: MultiRowRenderState
  sources: MultiRowSource[]
  // `sources` with the per-row painted color folded into `labelColor` when the
  // display asks for it — the sidebar's view of the rows, and the only one the
  // tree/labels layer should read
  labelSources: MultiRowSource[]
  effectiveRowHeight: number
  treeAreaWidth: number
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
  // Captioned above the exported tree — for this display it also records the
  // color scheme, which IS the clustering matrix here.
  clusterProvenance?: ClusterProvenance
  showLegend: boolean
  hasLegendEntries: boolean
  showRowSeparators: boolean
  showRowLabels: boolean
  colorLegend: LegendEntry[]
  rowGroupLegend: LegendItem[]
  hiddenCategorySet: ReadonlySet<string>
}

export async function renderSvg(
  self: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(self, opts, MultiRowSvgBody)
}

function MultiRowSvgBody({
  model: self,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  const state = {
    ...self.renderState,
    // canvasWidth is the block scissor bound, so it has to be the width this
    // layer is actually painted at — see LgvSvgBodyProps.canvasWidth.
    canvasWidth,
    canvasHeight: height,
  }
  // From the user-selected export theme rather than the live on-screen palette,
  // so a light export of a dark session stays light — plugin-maf's rule for the
  // same glyph.
  const insertionColor = resolvePalette({ configTheme: opts?.theme }).insertion
  return (
    <>
      <SvgClipRect
        id={`multirow-clip-${svgNodeId(self)}`}
        width={canvasWidth}
        height={height}
      >
        <PaintLayer
          width={canvasWidth}
          height={height}
          opts={opts}
          paint={ctx => {
            drawMultiRowBlocks(ctx, self.rpcDataMap, renderBlocks, state)
            // Same layer, after the blocks, so the export stacks them the way
            // the on-screen overlay composites over the canvas.
            drawMultiRowIndelGlyphs(
              ctx,
              self.rpcDataMap,
              renderBlocks,
              state,
              insertionColor,
            )
          }}
        />
      </SvgClipRect>
      {/* before the sidebar, matching the live display's stacking: the tree
          panel paints over the lines rather than the lines over the tree */}
      {self.showRowSeparators ? (
        <RowSeparatorLines
          numRows={self.sources.length}
          rowHeight={self.effectiveRowHeight}
          width={canvasWidth}
          opacity={SEPARATOR_OPACITY}
        />
      ) : null}
      <SvgTreeSidebar
        showTree={self.showTree}
        showLabels={self.showRowLabels}
        hierarchy={self.hierarchy}
        sources={self.labelSources}
        rowHeight={self.effectiveRowHeight}
        treeAreaWidth={self.treeAreaWidth}
        availableHeight={height}
        clusterProvenance={self.clusterProvenance}
      />
      {self.showLegend && self.hasLegendEntries ? (
        <MultiRowColorLegend
          entries={self.colorLegend}
          rowGroupItems={self.rowGroupLegend}
          canvasWidth={canvasWidth}
          maxHeight={height}
          hiddenLabels={self.hiddenCategorySet}
        />
      ) : null}
    </>
  )
}
