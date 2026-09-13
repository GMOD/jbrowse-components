/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { ScorePlotSvgFrame } from '@jbrowse/wiggle-core'

import type { MarkDisplayModel } from './components/markDisplayTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { ScorePlotSvgModel } from '@jbrowse/wiggle-core'
import type React from 'react'

type RenderSvgModel = MarkDisplayModel & ScorePlotSvgModel

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, MarkSvgBody)
}

function MarkSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model } = props
  return (
    <ScorePlotSvgFrame
      {...props}
      clipIdPrefix="marks"
      paint={(ctx, { canvasWidth: w, drawHeight, renderBlocks }) => {
        paintMarkBlocks(ctx, model.markList, model.rpcDataMap, renderBlocks, {
          ...model.renderState,
          canvasWidth: w,
          canvasHeight: drawHeight,
        })
      }}
    />
  )
}
