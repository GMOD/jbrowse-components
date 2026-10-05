/* eslint-disable react-refresh/only-export-components */
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import { SvgConnectorField } from '../../shared/ConnectorLines.tsx'
import { MATRIX_CONNECTOR_STROKE_PX } from '../../shared/constants.ts'
import SvgVariantOverlay from '../components/SvgVariantOverlay.tsx'
import { VARIANT_MATRIX_MARKS } from './variantMatrixMarks.ts'

import type { ConnectorLinesModel } from '../../shared/ConnectorLines.tsx'
import type { RenderSvgBaseModel } from '../renderSvgUtils.ts'
import type {
  MatrixRenderState,
  VariantMatrixRenderBlock,
  VariantMatrixUploadData,
} from './variantMatrixRenderingBackendTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

interface MatrixRenderSvgModel
  extends
    RenderSvgBaseModel,
    Pick<ConnectorLinesModel, 'connectorLineCoords' | 'lineZoneHeight'> {
  renderState: MatrixRenderState
  paintedRegionRows: ReadonlyMap<number, VariantMatrixUploadData>
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
  // The matrix paints at its own renderState width, the content width its
  // columns, connector lines and hit test key off, from the column origin the
  // live matrix body takes: when the content doesn't reach the left viewport
  // edge, the matrix moves right with the ruler. The shell's viewport
  // `canvasWidth` only frames the overlay. The connector lines need no
  // transform: their coords are viewport-relative already.
  const { renderState } = model
  const { left } = model.columnGeometry
  return (
    <SvgVariantOverlay
      model={model}
      width={canvasWidth}
      overlays={overlays}
      text={opts}
      lineZone={
        <SvgConnectorField
          coords={model.connectorLineCoords}
          lineZoneHeight={model.lineZoneHeight}
          width={canvasWidth}
          strokeWidth={MATRIX_CONNECTOR_STROKE_PX}
          opts={opts}
        />
      }
    >
      <g transform={`translate(${left})`}>
        <MarkSvgLayer
          marks={VARIANT_MATRIX_MARKS}
          regions={model.paintedRegionRows}
          blocks={model.matrixBlocks}
          state={renderState}
          width={renderState.canvasWidth}
          height={renderState.canvasHeight}
          opts={opts}
        />
      </g>
    </SvgVariantOverlay>
  )
}
