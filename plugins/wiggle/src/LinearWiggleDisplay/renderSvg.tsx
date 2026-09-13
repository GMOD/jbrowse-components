/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { ScorePlotSvgFrame } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'

import { encodeWiggleRegions } from '../shared/buildSourceRenderData.ts'
import { WIGGLE_MARKS } from '../shared/wiggleMarks.ts'

import type { LinearWiggleDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
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
    <ScorePlotSvgFrame
      {...props}
      plotGeometry={model.plotGeometry}
      marks={WIGGLE_MARKS}
      regions={encodeWiggleRegions(model)}
      renderState={model.renderState}
    />
  )
}
