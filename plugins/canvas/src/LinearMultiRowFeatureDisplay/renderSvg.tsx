/* eslint-disable react-refresh/only-export-components */
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { RowSeparatorLines, SvgTreeSidebar } from '@jbrowse/tree-sidebar'

import { MULTI_ROW_MARKS } from './rendering/multiRowMarks.ts'
import { SEPARATOR_OPACITY } from './rendering/rowBand.ts'

import type { MultiRowEncoded } from './rendering/multiRowChannels.ts'
import type { MultiRowRenderState } from './rendering/multiRowRenderingBackendTypes.ts'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { RowSource, SvgSidebarProps } from '@jbrowse/tree-sidebar'

export interface RenderSvgModel extends LgvSvgExportable {
  encodedChannels: ReadonlyMap<number, MultiRowEncoded>
  renderState: MultiRowRenderState
  sources: RowSource[]
  svgSidebar: SvgSidebarProps
  effectiveRowHeight: number
  rowsTopOffset: number
  rowsHeight: number
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
  canvasWidth,
  renderBlocks,
  overlays,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  return (
    <>
      <g transform={`translate(0 ${self.rowsTopOffset})`}>
        <MarkSvgLayer
          marks={MULTI_ROW_MARKS}
          regions={self.encodedChannels}
          blocks={renderBlocks}
          state={self.renderState}
          width={canvasWidth}
          height={self.rowsHeight}
          opts={opts}
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
            availableHeight={self.rowsHeight}
          />
        ) : null}
      </g>
    </>
  )
}
