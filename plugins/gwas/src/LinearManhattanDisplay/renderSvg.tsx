/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { WiggleFamilySvgFrame } from '@jbrowse/plugin-wiggle'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { MANHATTAN_MARKS } from './manhattanMarks.ts'

import type { ManhattanDisplayModel } from './components/manhattanDisplayTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { WiggleFamilySvgModel } from '@jbrowse/plugin-wiggle'
import type React from 'react'

// Importing the full LinearManhattanDisplayModel here would close a type cycle
// (factory return type → renderSvg action → model instance → factory return
// type), so this reuses the component's hand-rolled slice of the same model —
// which already covers every paint input — plus the shared
// SvgChrome/axis/cross-hatch fields. Reusing it rather than re-declaring the
// fields keeps the export under the `_ModelSatisfiesComponentContract` guard in
// stateModelFactory.ts instead of adding a second slice that drifts on its own.
type RenderSvgModel = ManhattanDisplayModel & WiggleFamilySvgModel

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, ManhattanSvgBody)
}

function ManhattanSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model } = props
  return (
    <WiggleFamilySvgFrame
      {...props}
      clipIdPrefix="manhattan"
      paint={(ctx, { canvasWidth: w, drawHeight, renderBlocks }) => {
        paintMarkBlocks(ctx, MANHATTAN_MARKS, model.rpcDataMap, renderBlocks, {
          ...model.renderState,
          canvasWidth: w,
          canvasHeight: drawHeight,
        })
      }}
    />
  )
}
