/* eslint-disable react-refresh/only-export-components */
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SvgChrome, awaitSvgReady } from '@jbrowse/plugin-linear-genome-view'

import { drawVariantMatrixBlocks } from './components/Canvas2DVariantMatrixRenderer.ts'
import SvgVariantOverlay from '../shared/components/SvgVariantOverlay.tsx'

import type { RenderSvgBaseModel } from '../shared/renderSvgUtils.ts'
import type { MatrixCellData } from './components/computeVariantMatrixCells.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface MatrixRenderSvgModel extends RenderSvgBaseModel {
  flipped: boolean
}

export async function renderSvg(
  model: MatrixRenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // svgReady waits for every visible region to load (not just the first datum)
  // and goes false during an in-place refetch, so exports never capture a
  // partial or stale viewport.
  await awaitSvgReady(model)
  const view = getContainingView(model) as LGV
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <VariantMatrixSvgBody
        model={model}
        view={view}
        height={height}
        opts={opts}
      />
    </SvgChrome>
  )
}

function VariantMatrixSvgBody({
  model,
  view,
  height,
  opts,
}: {
  model: MatrixRenderSvgModel
  view: LGV
  height: number
  opts: ExportSvgDisplayOptions | undefined
}) {
  const cellData = model.cellData as MatrixCellData | undefined
  // narrow the nullable cell data; an empty (numCells === 0) matrix still
  // paints nothing — drawVariantMatrixBlocks handles it.
  if (!cellData) {
    return null
  }

  const {
    effectiveRowHeight: rowHeight,
    scrollTop,
    availableHeight,
    canDisplayLabels,
  } = model
  const canvasWidth = view.totalWidthPxWithoutBorders
  const cellsNode = paintLayer(canvasWidth, availableHeight, opts, ctx => {
    drawVariantMatrixBlocks(ctx, cellData, {
      canvasWidth,
      canvasHeight: availableHeight,
      rowHeight,
      scrollTop,
      flipped: model.flipped,
    })
  })

  const sources = model.sources ?? []
  return (
    <SvgVariantOverlay
      id={`variant-matrix-clip-${model.id}`}
      width={canvasWidth}
      height={height}
      content={cellsNode}
      sources={sources}
      rowHeight={rowHeight}
      scrollTop={scrollTop}
      availableHeight={availableHeight}
      canDisplayLabels={canDisplayLabels}
      hierarchy={model.hierarchy}
      showTree={model.showTree}
      treeAreaWidth={model.treeAreaWidth}
    />
  )
}
