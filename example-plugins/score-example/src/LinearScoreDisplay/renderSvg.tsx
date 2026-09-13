// #exampleFile shared | SVG export: the mark list painted through renderDisplaySvg
/* eslint-disable react-refresh/only-export-components */
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

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

// The same painter the Canvas2D backend runs, handed an SVG context. The
// export's width is the shell's, not the on-screen renderState's, which
// subtracts the track outline the export does not draw. The shell clips the
// body to its box.
function ScoreSvgBody({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<ScoreSvgModel>) {
  const state = { ...model.renderState, canvasWidth, canvasHeight: height }
  return (
    <PaintLayer
      width={canvasWidth}
      height={height}
      opts={opts}
      paint={ctx => {
        paintMarkBlocks(ctx, SCORE_MARKS, model.rpcDataMap, renderBlocks, state)
      }}
    />
  )
}
// #endregion
