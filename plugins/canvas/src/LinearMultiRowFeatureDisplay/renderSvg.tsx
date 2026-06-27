/* eslint-disable react-refresh/only-export-components */
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels } from '@jbrowse/tree-sidebar'

import { drawMultiRowBlocks } from './rendering/drawMultiRowBlocks.ts'

import type { LinearMultiRowFeatureDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  self: LinearMultiRowFeatureDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  await awaitSvgReady(self)
  const view = getContainingView(self) as LinearGenomeViewModel
  const height = opts.overrideHeight ?? self.height
  return (
    <SvgChrome error={self.error} width={view.width} height={height}>
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
  self: LinearMultiRowFeatureDisplayModel
  view: LinearGenomeViewModel
  height: number
  opts: ExportSvgDisplayOptions
}) {
  const state = self.renderState
  if (!state) {
    return null
  }
  const el = paintLayer(view.width, height, opts, ctx => {
    drawMultiRowBlocks(ctx, self.rpcDataMap, self.renderBlocks, {
      ...state,
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
