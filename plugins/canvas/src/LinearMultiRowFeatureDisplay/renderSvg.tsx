/* eslint-disable react-refresh/only-export-components */
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { RowSeparatorLines, SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { drawDensityBand } from '../shared/densityBand.ts'
import { drawMultiRowIndelGlyphs } from './rendering/drawMultiRowIndelGlyphs.ts'
import { MULTI_ROW_MARKS } from './rendering/multiRowMarks.ts'
import { SEPARATOR_OPACITY } from './rendering/rowBand.ts'

import type { DensityBandLayer } from '../shared/densityBand.ts'
import type { MultiRowEncoded } from './rendering/multiRowChannels.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type {
  ClusterHierarchyNode,
  ClusterProvenance,
  RowBand,
  RowSource,
} from '@jbrowse/tree-sidebar'

export interface RenderSvgModel extends SvgExportable {
  id: string
  height: number
  // The band is drawn in the too-large terminal, so the note that would replace
  // this whole body must not.
  drawsWhenTooLarge: boolean
  coarseTierStandsIn: boolean
  densityBandLayer: DensityBandLayer
  densityPeakReadout: string
  indelGlyphRegions: ReadonlyMap<number, MultiRowRegionData> | undefined
  // the screen's own channels: `renderState` spreads `featurePaintInputs`, the
  // encode's only inputs, so what the upload holds is what the export paints
  encodedChannels: ReadonlyMap<number, MultiRowEncoded>
  renderState: MultiRowRenderState
  sources: RowSource[]
  // The sidebar's view of the rows, and the only one the tree/labels layer
  // should read.
  labelSources: RowSource[]
  rowBands: readonly RowBand[]
  effectiveRowHeight: number
  treeAreaWidth: number
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
  // Records the color scheme, which is the clustering matrix here.
  rowTreeProvenance?: ClusterProvenance
  showRowSeparators: boolean
  showRowLabels: boolean
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
  overlays,
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
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          if (self.coarseTierStandsIn) {
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
          if (overlays && self.indelGlyphRegions) {
            drawMultiRowIndelGlyphs(
              ctx,
              self.indelGlyphRegions,
              renderBlocks,
              state,
              exportPalette.insertion,
            )
          }
        }}
      />
      {/* Before the sidebar, so the tree panel paints over the lines */}
      {overlays && self.showRowSeparators ? (
        <RowSeparatorLines
          numRows={self.sources.length}
          rowHeight={self.effectiveRowHeight}
          width={canvasWidth}
          opacity={SEPARATOR_OPACITY}
        />
      ) : null}
      {overlays ? (
        <SvgTreeSidebar
          showTree={self.showTree}
          showLabels={self.showRowLabels}
          hierarchy={self.hierarchy}
          sources={self.labelSources}
          rowHeight={self.effectiveRowHeight}
          treeAreaWidth={self.treeAreaWidth}
          availableHeight={height}
          bands={self.rowBands}
        />
      ) : null}
    </>
  )
}
