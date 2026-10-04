// #exampleFile shared | SVG export: the mark list painted through renderDisplaySvg
/* eslint-disable react-refresh/only-export-components */
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import { SCORE_MARKS } from './scoreMarks.ts'

import type { ScoreRegionData } from '../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreMarks.ts'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

// The slice of the model the export reads. A named slice rather than the
// model's own instance type, which would close a type cycle through the
// `renderSvg` action that imports this file.
interface ScoreSvgModel extends LgvSvgExportable {
  rpcDataMap: ReadonlyMap<number, ScoreRegionData>
  renderState: ScoreRenderState
}

// #region render-svg
export async function renderSvg(
  model: ScoreSvgModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(model, opts, ScoreSvgBody)
}

// The same painter the Canvas2D backend runs, handed an SVG context, at the
// export's size. The shell clips the body to its box.
function ScoreSvgBody({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<ScoreSvgModel>) {
  return (
    <MarkSvgLayer
      marks={SCORE_MARKS}
      regions={model.rpcDataMap}
      blocks={renderBlocks}
      state={model.renderState}
      width={canvasWidth}
      height={height}
      opts={opts}
    />
  )
}
// #endregion
