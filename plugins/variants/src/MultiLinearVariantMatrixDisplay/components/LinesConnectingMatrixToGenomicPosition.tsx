import React from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { MultiLinearVariantMatrixDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const Wrapper = observer(function ({
  children,
  model,
  exportSVG,
}: {
  model: MultiLinearVariantMatrixDisplayModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  const { height } = model
  return exportSVG ? (
    <g
      transform={`translate(${Math.max(
        0,
        -(getContainingView(model) as LinearGenomeViewModel).offsetPx,
      )})`}
    >
      {children}
    </g>
  ) : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: Math.max(
          0,
          -(getContainingView(model) as LinearGenomeViewModel).offsetPx,
        ),
        pointerEvents: 'none',
        height,
        width: getContainingView(model).width,
      }}
    >
      {children}
    </svg>
  )
})

const LinesConnectingMatrixToGenomicPosition = observer(function ({
  model,
  exportSVG,
}: {
  model: MultiLinearVariantMatrixDisplayModel
  exportSVG?: boolean
}) {
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { featuresVolatile } = model
  const { offsetPx, assemblyNames } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const b0 = view.dynamicBlocks.contentBlocks[0]?.widthPx || 0
  const w = b0 / (featuresVolatile?.length || 1)
  return assembly && featuresVolatile ? (
    <Wrapper exportSVG={exportSVG} model={model}>
      {featuresVolatile.map((f, i) => {
        const c =
          (view.bpToPx({
            refName:
              assembly.getCanonicalRefName(f.get('refName')) ||
              f.get('refName'),
            coord: f.get('start'),
          })?.offsetPx || 0) - Math.max(offsetPx, 0)
        return (
          <line
            stroke="black"
            key={f.id()}
            x1={i * w + w / 2}
            x2={c}
            y1={20}
            y2={0}
          />
        )
      })}
    </Wrapper>
  ) : null
})

export default LinesConnectingMatrixToGenomicPosition
