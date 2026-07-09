/* eslint-disable react-refresh/only-export-components */
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, SvgTreePath } from '@jbrowse/tree-sidebar'

import { drawMultiRowBlocks } from './rendering/drawMultiRowBlocks.ts'

import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { MultiRowSource } from './sourcesLogic.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

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
  rowHeight: number
  sidebarOffset: number
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
}

export async function renderSvg(
  self: RenderSvgModel,
  opts: ExportSvgDisplayOptions,
) {
  await awaitSvgReady(self)
  const view = getContainingView(self) as LinearGenomeViewModel
  const height = opts.overrideHeight ?? self.height
  return (
    <SvgChrome
      error={self.error}
      regionTooLarge={self.regionTooLarge}
      width={view.width}
      height={height}
    >
      <MultiRowSvgBody self={self} view={view} height={height} opts={opts} />
    </SvgChrome>
  )
}

function MultiRowSvgBody({
  self,
  view,
  height,
  opts,
}: {
  self: RenderSvgModel
  view: LinearGenomeViewModel
  height: number
  opts: ExportSvgDisplayOptions
}) {
  const el = paintLayer(view.width, height, opts, ctx => {
    drawMultiRowBlocks(ctx, self.rpcDataMap, self.renderBlocks, {
      ...self.renderState,
      canvasHeight: height,
    })
  })
  return (
    <>
      <SvgClipRect
        id={`multirow-clip-${self.id}`}
        width={view.width}
        height={height}
      >
        {el}
      </SvgClipRect>
      {self.showTree && self.hierarchy ? (
        <SvgTreePath hierarchy={self.hierarchy} />
      ) : null}
      {self.sources.length ? (
        <SvgRowLabels
          sources={self.sources}
          rowHeight={self.rowHeight}
          labelOffset={self.sidebarOffset}
          availableHeight={height}
        />
      ) : null}
    </>
  )
}
