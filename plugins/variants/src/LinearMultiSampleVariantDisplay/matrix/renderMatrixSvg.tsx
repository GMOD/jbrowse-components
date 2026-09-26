/* eslint-disable react-refresh/only-export-components */
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import SvgVariantOverlay from '../../shared/components/SvgVariantOverlay.tsx'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import { VARIANT_MATRIX_MARKS } from './variantMatrixMarks.ts'

import type { RenderSvgBaseModel } from '../../shared/renderSvgUtils.ts'
import type { MatrixConnectorLinesModel } from './LinesConnectingMatrixToGenomicPosition.tsx'
import type {
  MatrixRenderState,
  VariantMatrixRenderBlock,
  VariantMatrixUploadData,
} from './variantMatrixRenderingBackendTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

interface MatrixRenderSvgModel
  extends RenderSvgBaseModel, MatrixConnectorLinesModel {
  renderState: MatrixRenderState
  placedMatrixData: VariantMatrixUploadData | undefined
  matrixRegions: ReadonlyMap<number, VariantMatrixUploadData>
  matrixBlocks: VariantMatrixRenderBlock[]
  // only `left` is read here — the column origin the matrix is shifted to when
  // the content doesn't reach the left viewport edge
  columnGeometry: { left: number }
}

export async function renderSvg(
  model: MatrixRenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, VariantMatrixSvgBody)
}

function VariantMatrixSvgBody({
  model,
  overlays,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<MatrixRenderSvgModel>) {
  // reuse the model's own render state so the export lays columns out on the
  // exact geometry the live canvas does. Unlike the other canvas displays, the
  // matrix's renderState.canvasWidth is view.totalWidthPxWithoutBorders (the
  // content width its columns, connector lines and hit-test all key off), not
  // the outline-adjusted track width — so it is the right paint width here and
  // the shell's viewport `canvasWidth` only frames the overlay.
  const { placedMatrixData, renderState } = model
  const { canvasWidth: matrixWidth, canvasHeight } = renderState
  // The same origin the live matrix body takes (VariantMatrixDisplayComponent)
  // and the same one the columns are laid out from: when the content doesn't
  // reach the left viewport edge the matrix moves right with the ruler. The
  // connector lines need no transform — their coords are already
  // viewport-relative, off this same origin.
  const { left } = model.columnGeometry

  // svgReady + SvgChrome already guarantee a loaded, non-terminal state here, so
  // this narrows the single nullable fetch blob for TS only — unreachable at
  // runtime. An empty (numCells === 0) matrix still paints nothing. Placed, not
  // raw: the export draws the rows the screen draws.
  return placedMatrixData ? (
    <SvgVariantOverlay
      model={model}
      width={canvasWidth}
      overlays={overlays}
      lineZone={
        <LinesConnectingMatrixToGenomicPosition
          model={model}
          exportSVG
          opts={opts}
        />
      }
    >
      <g transform={`translate(${left})`}>
        <PaintLayer
          width={matrixWidth}
          height={canvasHeight}
          opts={opts}
          paint={ctx => {
            paintMarkBlocks(
              ctx,
              VARIANT_MATRIX_MARKS,
              model.matrixRegions,
              model.matrixBlocks,
              renderState,
            )
          }}
        />
      </g>
    </SvgVariantOverlay>
  ) : null
}
