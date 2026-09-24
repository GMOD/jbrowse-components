/* eslint-disable react-refresh/only-export-components */
import TriangleMatrixSvgLayer from '@jbrowse/display-kit/TriangleMatrixSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import LDColumnZone from './components/LDColumnZone.tsx'
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

function LdSvgBody({
  model,
  height,
  canvasWidth,
  overlays,
  opts,
}: LgvSvgBodyProps<LDDisplayModel>) {
  return (
    <>
      <TriangleMatrixSvgLayer
        marks={LD_MARKS}
        regions={model.matrixRegions}
        state={model.triangleFrame}
        width={canvasWidth}
        height={height}
        top={model.matrixTop}
        opts={opts}
      />
      {overlays ? <LDColumnZone model={model} exportSVG opts={opts} /> : null}
    </>
  )
}
