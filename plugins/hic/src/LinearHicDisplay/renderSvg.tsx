/* eslint-disable react-refresh/only-export-components */
import TriangleMatrixSvgLayer from '@jbrowse/display-kit/TriangleMatrixSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import { HIC_MARKS } from './components/hicMarks.ts'

import type { LinearHicDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

export async function renderSvg(
  self: LinearHicDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(self, opts, HicSvgBody)
}

function HicSvgBody({
  model,
  height,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<LinearHicDisplayModel>) {
  return (
    <TriangleMatrixSvgLayer
      marks={HIC_MARKS}
      regions={model.matrixRegions}
      state={model.renderState}
      width={canvasWidth}
      height={height}
      top={0}
      opts={opts}
    />
  )
}
