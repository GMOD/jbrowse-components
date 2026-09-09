/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { WiggleFamilySvgFrame } from '@jbrowse/plugin-wiggle'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import type { MarkDisplayModel } from './components/markDisplayTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { WiggleFamilySvgModel } from '@jbrowse/plugin-wiggle'
import type React from 'react'

type RenderSvgModel = MarkDisplayModel & WiggleFamilySvgModel

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, MarkSvgBody)
}

function MarkSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model } = props
  return (
    <WiggleFamilySvgFrame
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
