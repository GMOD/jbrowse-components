import { Suspense, lazy, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import {
  getContainingView,
  getSession,
  getStrokeProps,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LinearArcDisplayModel } from '../model.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const ArcTooltip = lazy(() => import('../../ArcTooltip.tsx'))

type LGV = LinearGenomeViewModel

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

function getSemicirclePath(centerX: number, radius: number) {
  const start = polarToCartesian(centerX, 0, radius, 270)
  const end = polarToCartesian(centerX, 0, radius, 90)
  return {
    d: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 0 ${end.x} ${end.y}`,
    textYCoord: radius,
  }
}

function getBezierPath(left: number, right: number, height: number) {
  return {
    d: `M ${left} 0 C ${left} ${height}, ${right} ${height}, ${right} 0`,
    textYCoord: 0.75 * height,
  }
}

const Arc = observer(function Arc({
  model,
  feature,
  config,
  assembly,
  view,
  semicircle,
  selected,
}: {
  feature: Feature
  model: LinearArcDisplayModel
  config: AnyConfigurationModel
  assembly: Assembly
  view: LGV
  semicircle: boolean
  selected: boolean
}) {
  const [mouseOvered, setMouseOvered] = useState(false)
  const { height } = model
  const refName = feature.get('refName')
  const ra = assembly.getCanonicalRefName(refName) || refName
  const l = view.bpToPx({ refName: ra, coord: feature.get('start') })?.offsetPx
  const r = view.bpToPx({ refName: ra, coord: feature.get('end') })?.offsetPx

  if (l === undefined || r === undefined) {
    return null
  }

  const left = l - view.offsetPx
  const right = r - view.offsetPx
  const stroke = selected ? 'red' : readConfObject(config, 'color', { feature })
  const textStroke = selected ? 'red' : 'black'
  const label = readConfObject(config, 'label', { feature })
  const caption = readConfObject(config, 'caption', { feature })
  const strokeWidth = readConfObject(config, 'thickness', { feature }) ?? 2
  const centerX = left + (right - left) / 2
  const radius = (right - left) / 2
  const arcHeight = Math.min(
    readConfObject(config, 'height', { feature }) ?? 100,
    height,
  )
  const { d, textYCoord } = semicircle
    ? getSemicirclePath(centerX, radius)
    : getBezierPath(left, right, arcHeight)

  return (
    <g>
      <path
        {...getStrokeProps(stroke)}
        d={d}
        strokeWidth={strokeWidth}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onClick={() => {
          model.selectFeature(feature)
        }}
        onMouseOver={() => {
          setMouseOvered(true)
        }}
        onMouseLeave={() => {
          setMouseOvered(false)
        }}
        pointerEvents="stroke"
      />
      {mouseOvered ? (
        <Suspense fallback={null}>
          <ArcTooltip contents={caption} />
        </Suspense>
      ) : null}
      <text x={centerX} y={textYCoord + 3} stroke="white" strokeWidth="0.6em">
        {label}
      </text>
      <text x={centerX} y={textYCoord + 3} stroke={textStroke}>
        {label}
      </text>
    </g>
  )
})

const Arcs = observer(function Arcs({
  model,
  exportSVG,
}: {
  model: LinearArcDisplayModel
  exportSVG?: boolean
}) {
  const view = getContainingView(model) as LGV
  const { assemblyManager } = getSession(model)
  const { features, height, rendererConfig, displayModeSetting } = model
  const assembly = assemblyManager.get(view.assemblyNames[0]!)

  if (!assembly) {
    return null
  }

  const semicircle = displayModeSetting === 'semicircles'
  const { selectedFeatureId } = model
  const arcs = features?.map(f => (
    <Arc
      key={f.id()}
      feature={f}
      config={rendererConfig}
      view={view}
      model={model}
      assembly={assembly}
      semicircle={semicircle}
      selected={selectedFeatureId === f.id()}
    />
  ))

  return exportSVG ? (
    <>{arcs}</>
  ) : (
    <svg width={view.totalWidthPx} height={height}>
      {arcs}
    </svg>
  )
})

export default Arcs
