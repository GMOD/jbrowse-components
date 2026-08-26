import { getStrokeProps } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ArcGlyph from '../../shared/ArcGlyph.tsx'
import ArcsContainer from '../../shared/ArcsContainer.tsx'

import type { LinearArcDisplayModel } from '../model.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel
type ArcStyle = NonNullable<LinearArcDisplayModel['arcStyles']>[number]

// Semicircle dipping down from (left,0) to (right,0). A reversed region puts
// `left` past `right`, and the sweep flag is the other half of that mirror: the
// radius and the label y are `Math.abs`'d, so a fixed `0` swept the arc the
// wrong way round and put the apex ABOVE the baseline, outside the container's
// <svg> and clipped to two dots on the axis.
export function getSemicirclePath(left: number, right: number) {
  const radius = Math.abs(right - left) / 2
  const sweep = left <= right ? 0 : 1
  return {
    d: `M ${left} 0 A ${radius} ${radius} 0 0 ${sweep} ${right} 0`,
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
  hoverColor,
  exportSVG,
}: {
  model: LinearArcDisplayModel
  style: ArcStyle
  assembly: Assembly
  view: LGV
  semicircle: boolean
  selected: boolean
  hoverColor: string
  exportSVG?: boolean
}) {
  const { feature, color, thickness, label, caption, arcHeight } = style
  const refName = feature.get('refName')
  const ra = assembly.getCanonicalRefName2(refName)
  const l = view.bpToPx({ refName: ra, coord: feature.get('start') })?.offsetPx
  const r = view.bpToPx({ refName: ra, coord: feature.get('end') })?.offsetPx

  if (l === undefined || r === undefined) {
    return null
  }

  const left = l - view.offsetPx
  const right = r - view.offsetPx
  const textStroke = selected ? 'red' : 'black'
  const centerX = (left + right) / 2
  const { d, textYCoord } = semicircle
    ? getSemicirclePath(left, right)
    : getBezierPath(left, right, arcHeight)

  return (
    <ArcGlyph
      model={model}
      feature={feature}
      left={left}
      right={right}
      viewWidth={view.width}
      tooltip={caption}
      exportSVG={exportSVG}
    >
      {(hovered, events) => (
        <g>
          <path
            {...getStrokeProps(selected ? 'red' : hovered ? hoverColor : color)}
            d={d}
            strokeWidth={thickness}
            fill="transparent"
            {...events}
          />
          <text
            x={centerX}
            y={textYCoord + 3}
            stroke="white"
            strokeWidth="0.6em"
          >
            {label}
          </text>
          <text x={centerX} y={textYCoord + 3} stroke={textStroke}>
            {label}
          </text>
        </g>
      )}
    </ArcGlyph>
  )
})

const Arcs = observer(function Arcs({
  model,
  exportSVG,
}: {
  model: LinearArcDisplayModel
  exportSVG?: boolean
}) {
  const { arcStyles, displayMode, selectedFeatureId } = model
  const semicircle = displayMode === 'semicircles'
  return (
    <ArcsContainer model={model} exportSVG={exportSVG}>
      {(assembly, view, hoverColor) =>
        arcStyles?.map(style => (
          <Arc
            key={style.feature.id()}
            model={model}
            style={style}
            view={view}
            assembly={assembly}
            semicircle={semicircle}
            selected={selectedFeatureId === style.feature.id()}
            hoverColor={hoverColor}
            exportSVG={exportSVG}
          />
        ))
      }
    </ArcsContainer>
  )
})

export default Arcs
