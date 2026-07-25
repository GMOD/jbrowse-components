/* eslint-disable react-refresh/only-export-components */
import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { SvgChrome, awaitSvgReady } from '@jbrowse/plugin-linear-genome-view'

import SvgVariantOverlay from '../shared/components/SvgVariantOverlay.tsx'
import { REFERENCE_COLOR } from '../shared/constants.ts'
import { drawVariantMatrixBlocks } from './components/Canvas2DVariantMatrixRenderer.ts'
import LinesConnectingMatrixToGenomicPosition from './components/LinesConnectingMatrixToGenomicPosition.tsx'

import type { RenderSvgBaseModel } from '../shared/renderSvgUtils.ts'
import type { ConnectorLinesModel } from './components/LinesConnectingMatrixToGenomicPosition.tsx'
import type { MatrixRenderState } from './components/variantMatrixRenderingBackendTypes.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface MatrixRenderSvgModel extends RenderSvgBaseModel, ConnectorLinesModel {
  referenceDrawingMode: string
  renderState: MatrixRenderState
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
  const height = model.height
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
  // reuse the model's own render state so the export lays columns out on the
  // exact geometry the live canvas does
  const { cellData, referenceDrawingMode, renderState } = model
  const { canvasWidth, canvasHeight } = renderState
  // same shift the live matrix body takes (VariantMatrixDisplayComponent):
  // when the content doesn't reach the left viewport edge (offsetPx < 0) the
  // matrix moves right with the ruler. The connector lines need no transform —
  // their coords are already viewport-relative.
  const left = Math.max(0, -view.offsetPx)

  // svgReady + SvgChrome already guarantee a loaded, non-terminal state here, so
  // the mode check narrows the single nullable fetch blob for TS only —
  // unreachable at runtime. An empty (numCells === 0) matrix still paints
  // nothing.
  return cellData?.mode === 'matrix' ? (
    <SvgVariantOverlay
      model={model}
      idPrefix="variant-matrix-clip"
      width={view.width}
      height={height}
      lineZone={
        <LinesConnectingMatrixToGenomicPosition model={model} exportSVG />
      }
    >
      <g transform={`translate(${left})`}>
        <PaintLayer
          width={canvasWidth}
          height={canvasHeight}
          opts={opts}
          paint={ctx => {
            // Matrix always draws ref cells; "skip" mode is realized by a grey
            // background (matching the live canvas in VariantMatrixComponent),
            // so no-call cells read the same grey as ref instead of white.
            if (referenceDrawingMode === 'skip') {
              ctx.fillStyle = REFERENCE_COLOR
              ctx.fillRect(0, 0, canvasWidth, canvasHeight)
            }
            drawVariantMatrixBlocks(ctx, cellData, renderState)
          }}
        />
      </g>
    </SvgVariantOverlay>
  ) : null
}
