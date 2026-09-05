import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { RowSeparatorLines, SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { drawDensityBand } from '../shared/densityBand.ts'
import MultiRowColorLegend from './components/MultiRowColorLegend.tsx'
import { drawMultiRowIndelGlyphs } from './rendering/drawMultiRowIndelGlyphs.ts'
import { MULTI_ROW_MARKS } from './rendering/multiRowMarks.ts'
import { SEPARATOR_OPACITY } from './rendering/rowBand.ts'

import type { DensityBandLayer } from '../shared/densityBand.ts'
import type { LegendEntry } from './rendering/colorLegend.ts'
import type { MultiRowEncoded } from './rendering/multiRowChannels.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { MultiRowSource } from './rowSources.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { LegendItem } from '@jbrowse/core/ui'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type {
  ClusterProvenance,
  ClusterHierarchyNode,
} from '@jbrowse/tree-sidebar'

export interface RenderSvgModel extends SvgExportable {
  id: string
  height: number
  // The band is drawn in the too-large terminal, so the note that would replace
  // this whole body must not.
  drawsWhenTooLarge: boolean
  densityBandActive: boolean
  densityBandLayer: DensityBandLayer
  densityPeakReadout: string
  drawnRegionData: ReadonlyMap<number, MultiRowRegionData>
  // the screen's own channels: `renderState` spreads `featurePaintInputs`, the
  // encode's only inputs, so what the upload holds is what the export paints
  encodedChannels: ReadonlyMap<number, MultiRowEncoded>
  renderState: MultiRowRenderState
  sources: MultiRowSource[]
  // The sidebar's view of the rows, and the only one the tree/labels layer
  // should read.
  labelSources: MultiRowSource[]
  effectiveRowHeight: number
  treeAreaWidth: number
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
  // Records the color scheme, which is the clustering matrix here.
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
    // layer is actually painted at.
    canvasWidth,
    canvasHeight: height,
  }
  // From the user-selected export theme rather than the live on-screen palette,
  // so a light export of a dark session stays light.
  const exportPalette = resolvePalette({ configTheme: opts?.theme })
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
            if (self.densityBandActive) {
              drawDensityBand(ctx, renderBlocks, self.densityBandLayer, {
                canvasWidth,
                bandHeight: height,
                readout: self.densityPeakReadout,
                palette: exportPalette,
              })
            }
            paintMarkBlocks(
              ctx,
              MULTI_ROW_MARKS,
              self.encodedChannels,
              renderBlocks,
              state,
            )
            // Same layer, after the blocks, so the export stacks them the way
            // the on-screen overlay composites over the canvas.
            drawMultiRowIndelGlyphs(
              ctx,
              self.drawnRegionData,
              renderBlocks,
              state,
              exportPalette.insertion,
            )
          }}
        />
      </SvgClipRect>
      {/* Before the sidebar, so the tree panel paints over the lines */}
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
