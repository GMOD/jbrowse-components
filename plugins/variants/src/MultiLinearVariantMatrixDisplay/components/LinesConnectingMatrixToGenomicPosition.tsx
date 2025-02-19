import { useState } from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { MultiLinearVariantMatrixDisplayModel } from '../model'
import type { Feature } from '@jbrowse/core/util'
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
  const { width, offsetPx } = getContainingView(model) as LinearGenomeViewModel
  const left = Math.max(0, -offsetPx)
  return exportSVG ? (
    <g transform={`translate(${left})`}>{children}</g>
  ) : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left,
        height,
        width,
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
  const [mouseOverLine, setMouseOverLine] = useState<{
    f: Feature
    idx: number
    c: number
  }>()
  const { lineZoneHeight, featuresVolatile } = model
  const { assemblyNames, dynamicBlocks } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const b0 = dynamicBlocks.contentBlocks[0]?.widthPx || 0
  const w = b0 / (featuresVolatile?.length || 1)
  return assembly && featuresVolatile ? (
    <Wrapper exportSVG={exportSVG} model={model}>
      <AllLines model={model} setMouseOverLine={setMouseOverLine} />
      {mouseOverLine ? (
        <line
          stroke="#f00c"
          strokeWidth={3}
          key={mouseOverLine.f.id()}
          x1={mouseOverLine.idx * w + w / 2}
          x2={mouseOverLine.c}
          y1={lineZoneHeight}
          y2={0}
          onMouseLeave={() => {
            setMouseOverLine(undefined)
          }}
        />
      ) : null}
    </Wrapper>
  ) : null
})

const AllLines = observer(function ({
  model,
  setMouseOverLine,
}: {
  model: MultiLinearVariantMatrixDisplayModel
  setMouseOverLine: (arg: any) => void
}) {
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { lineZoneHeight, featuresVolatile } = model
  const { offsetPx, assemblyNames, dynamicBlocks } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const b0 = dynamicBlocks.contentBlocks[0]?.widthPx || 0
  const w = b0 / (featuresVolatile?.length || 1)
  const l = Math.max(offsetPx, 0)
  return assembly && featuresVolatile ? (
    <>
      {featuresVolatile.map((f, i) => {
        const ref = f.get('refName')
        const c =
          (view.bpToPx({
            refName: assembly.getCanonicalRefName(ref) || ref,
            coord: f.get('start'),
          })?.offsetPx || 0) - l
        return (
          <line
            stroke="#0004"
            strokeWidth={1}
            key={f.id()}
            x1={i * w + w / 2}
            x2={c}
            y1={lineZoneHeight}
            y2={0}
            onMouseEnter={() => {
              setMouseOverLine({ f, idx: i, c })
            }}
            onMouseLeave={() => {
              setMouseOverLine(undefined)
            }}
          />
        )
      })}
    </>
  ) : null
})

export default LinesConnectingMatrixToGenomicPosition
