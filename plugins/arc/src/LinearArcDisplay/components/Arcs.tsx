import { Suspense, lazy, useState } from 'react'

import {
  getContainingView,
  getSession,
  getStrokeProps,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LinearArcDisplayModel } from '../model.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const ArcTooltip = lazy(() => import('../../ArcTooltip.tsx'))

type LGV = LinearGenomeViewModel
type ArcStyle = NonNullable<LinearArcDisplayModel['arcStyles']>[number]

// semicircle dipping down from (left,0) to (right,0); SVG arc sweep-flag 0.
// `Math.abs` keeps the radius (and label y) positive when a reversed region
// puts `left` past `right`, matching the paired-arc convention.
function getSemicirclePath(left: number, right: number) {
  const radius = Math.abs(right - left) / 2
  return {
    d: `M ${left} 0 A ${radius} ${radius} 0 0 0 ${right} 0`,
    textYCoord: radius,
  }
}

// symmetric cubic bezier; control points at `height` put the apex at 0.75*height
function getBezierPath(left: number, right: number, height: number) {
  return {
    d: `M ${left} 0 C ${left} ${height}, ${right} ${height}, ${right} 0`,
    textYCoord: 0.75 * height,
  }
}

const Arc = observer(function Arc({
  model,
  style,
  assembly,
  view,
  semicircle,
  selected,
  exportSVG,
}: {
  model: LinearArcDisplayModel
  style: ArcStyle
  assembly: Assembly
  view: LGV
  semicircle: boolean
  selected: boolean
  exportSVG?: boolean
}) {
  const [mouseOvered, setMouseOvered] = useState(false)
  const { feature, color, thickness, label, caption, arcHeight } = style
  const refName = feature.get('refName')
  const ra = assembly.getCanonicalRefName(refName) || refName
  const l = view.bpToPx({ refName: ra, coord: feature.get('start') })?.offsetPx
  const r = view.bpToPx({ refName: ra, coord: feature.get('end') })?.offsetPx

  if (l === undefined || r === undefined) {
    return null
  }

  const left = l - view.offsetPx
  const right = r - view.offsetPx
  // on-screen arcs are clipped by the container; skip ones entirely off-screen.
  // min/max (not left/right directly) so a reversed region — where `left` lands
  // past `right` — isn't wrongly culled. export keeps everything so the full
  // region is captured.
  if (
    !exportSVG &&
    (Math.max(left, right) < 0 || Math.min(left, right) > view.width)
  ) {
    return null
  }

  const stroke = selected ? 'red' : color
  const textStroke = selected ? 'red' : 'black'
  const centerX = (left + right) / 2
  const { d, textYCoord } = semicircle
    ? getSemicirclePath(left, right)
    : getBezierPath(left, right, arcHeight)

  return (
    <g>
      <path
        {...getStrokeProps(stroke)}
        d={d}
        strokeWidth={thickness}
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
  const { arcStyles, height, displayMode, selectedFeatureId } = model
  const assembly = assemblyManager.get(view.assemblyNames[0]!)

  if (!assembly) {
    return null
  }

  const semicircle = displayMode === 'semicircles'
  const arcs = arcStyles?.map(style => (
    <Arc
      key={style.feature.id()}
      model={model}
      style={style}
      view={view}
      assembly={assembly}
      semicircle={semicircle}
      selected={selectedFeatureId === style.feature.id()}
      exportSVG={exportSVG}
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
