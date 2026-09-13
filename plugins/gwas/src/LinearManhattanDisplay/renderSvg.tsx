/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { ScorePlotSvgFrame } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'

import { MANHATTAN_MARKS } from './manhattanMarks.ts'

import type { ManhattanDisplayModel } from './components/manhattanDisplayTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { ScorePlotSvgModel } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'
import type React from 'react'

// The component's hand-rolled model slice, which `_ModelSatisfiesComponentContract`
// pins, rather than the inferred model, whose type would close a cycle through
// this export's own action.
type RenderSvgModel = ManhattanDisplayModel & ScorePlotSvgModel

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, ManhattanSvgBody)
}

function ManhattanSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model } = props
  return (
    <ScorePlotSvgFrame
      {...props}
      clipIdPrefix="manhattan"
      marks={MANHATTAN_MARKS}
      regions={model.rpcDataMap}
      renderState={model.renderState}
    />
  )
}
