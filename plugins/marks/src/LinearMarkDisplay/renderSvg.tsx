/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { ScorePlotSvgFrame } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'

import type { MarkDisplayModel } from './components/markDisplayTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { ScorePlotSvgModel } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'
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
      marks={model.markList}
      regions={model.rpcDataMap}
      renderState={model.renderState}
    />
  )
}
