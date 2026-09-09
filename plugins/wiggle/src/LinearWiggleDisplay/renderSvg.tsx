/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { WiggleFamilySvgFrame } from '../shared/WiggleFamilySvg.tsx'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import { WIGGLE_MARKS } from '../shared/wiggleMarks.ts'

import type { LinearWiggleDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { SourceRenderData } from '@jbrowse/wiggle-core'
import type React from 'react'

export async function renderSvg(
  model: LinearWiggleDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, WiggleSvgBody)
}

function WiggleSvgBody(props: LgvSvgBodyProps<LinearWiggleDisplayModel>) {
  const { model } = props
  return (
    <WiggleFamilySvgFrame
      {...props}
      clipIdPrefix="wiggle"
      paint={(ctx, { canvasWidth: w, drawHeight, renderBlocks }) => {
        const gpuProps = model.gpuProps()
        const regions = new Map<number, SourceRenderData[]>()
        for (const [idx, data] of model.rpcDataMap) {
          regions.set(idx, buildSourceRenderData(data, gpuProps))
        }
        paintMarkBlocks(ctx, WIGGLE_MARKS, regions, renderBlocks, {
          ...model.renderState,
          canvasWidth: w,
          canvasHeight: drawHeight,
        })
      }}
    />
  )
}
