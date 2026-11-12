/* eslint-disable react-refresh/only-export-components */
import TriangleMatrixSvgLayer from '@jbrowse/display-kit/TriangleMatrixSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import { HIC_MARKS } from './components/hicMarks.ts'

import type {
  HicRenderState,
  HicUploadData,
} from './components/hicRenderingBackendTypes.ts'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

interface HicSvgModel extends LgvSvgExportable {
  matrixRegions: ReadonlyMap<number, HicUploadData>
  renderState: HicRenderState
}

export async function renderSvg(
  model: HicSvgModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(model, opts, HicSvgBody)
}

function HicSvgBody({
  model,
  height,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<HicSvgModel>) {
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
