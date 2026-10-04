/* eslint-disable react-refresh/only-export-components */
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { RowSeparatorLines, SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { drawDensityBand } from '../shared/densityBand.ts'
import { drawMultiRowIndelGlyphs } from './rendering/drawMultiRowIndelGlyphs.ts'
import { MULTI_ROW_MARKS } from './rendering/multiRowMarks.ts'
import { SEPARATOR_OPACITY } from './rendering/rowBand.ts'

import type { DensityBandLayer } from '../shared/densityBand.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
  MultiRowUploadData,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { RowSource, SvgSidebarProps } from '@jbrowse/tree-sidebar'

export interface RenderSvgModel extends LgvSvgExportable {
  // The band is drawn in the too-large terminal, so the note that would replace
  // this whole body must not.
  drawsWhenTooLarge: boolean
  coarseTierStandsIn: boolean
  densityBandLayer: DensityBandLayer
  densityPeakReadout: string
  indelGlyphRegions: ReadonlyMap<number, MultiRowRegionData> | undefined
  uploadedChannelsIn: (
    palette: JBrowsePalette,
  ) => ReadonlyMap<number, MultiRowUploadData>
  renderState: MultiRowRenderState
  sources: RowSource[]
  svgSidebar: SvgSidebarProps
  effectiveRowHeight: number
  showRowSeparators: boolean
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
  const palette = usePalette()
  const uploaded = self.uploadedChannelsIn(palette)
  return (
    <>
      {self.coarseTierStandsIn ? (
        <PaintLayer
          width={canvasWidth}
          height={height}
          opts={opts}
          paint={ctx => {
            drawDensityBand(ctx, renderBlocks, self.densityBandLayer, {
              canvasWidth,
              bandHeight: height,
              readout: self.densityPeakReadout,
              palette,
            })
          }}
        />
      ) : null}
      <MarkSvgLayer
        marks={MULTI_ROW_MARKS}
        regions={uploaded}
        blocks={renderBlocks}
        state={self.renderState}
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={(ctx, state) => {
          // the overlay the screen composites over the canvas
          if (overlays && self.indelGlyphRegions) {
            drawMultiRowIndelGlyphs(
              ctx,
              self.indelGlyphRegions,
              uploaded,
              renderBlocks,
              state,
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
          sidebar={self.svgSidebar}
          text={opts}
          availableHeight={height}
        />
      ) : null}
    </>
  )
}
