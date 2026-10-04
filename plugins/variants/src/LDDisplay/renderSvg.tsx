/* eslint-disable react-refresh/only-export-components */
import TriangleMatrixSvgLayer from '@jbrowse/display-kit/TriangleMatrixSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import { SvgConnectorField } from '../shared/ConnectorLines.tsx'
import { LD_CONNECTOR_STROKE_PX } from '../shared/constants.ts'
import { ConnectorLabels } from './components/VariantLabels.tsx'
import { LD_MARKS } from './components/ldMarks.ts'

import type { LDDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

export async function renderSvg(
  self: LDDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(self, opts, LdSvgBody)
}

// `LDColumnZone`'s two forms, read once: the connector field in index mode,
// and the labels in both.
function LdSvgBody({
  model,
  height,
  canvasWidth,
  overlays,
  opts,
}: LgvSvgBodyProps<LDDisplayModel>) {
  const { connectorLineCoords: coords, lineZoneHeight, showLabels } = model
  return (
    <>
      <TriangleMatrixSvgLayer
        marks={LD_MARKS}
        regions={model.matrixRegions}
        state={model.renderState}
        width={canvasWidth}
        height={height}
        top={model.matrixTop}
        opts={opts}
      />
      {overlays && !model.effectiveUseGenomicPositions ? (
        <SvgConnectorField
          coords={coords}
          lineZoneHeight={lineZoneHeight}
          width={canvasWidth}
          strokeWidth={LD_CONNECTOR_STROKE_PX}
          opts={opts}
        />
      ) : null}
      {overlays && showLabels ? <ConnectorLabels coords={coords} /> : null}
    </>
  )
}
