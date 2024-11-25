import React from 'react'
import { getContainingView, when } from '@jbrowse/core/util'

// locals
import Arcs from './components/Arcs'
import type { LinearArcDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export async function renderArcSvg(
  model: LinearArcDisplayModel,
  _opts: {
    rasterizeLayers?: boolean
  },
) {
  await when(() => !model.loading)

  const view = getContainingView(model) as LinearGenomeViewModel
  const width = view.dynamicBlocks.totalWidthPx
  const height = model.height
  const clipid = `arc-${model.id}`
  return (
    <>
      <defs>
        <clipPath id={clipid}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipid})`}>
        <Arcs model={model} exportSVG={true} />
      </g>
    </>
  )
}
