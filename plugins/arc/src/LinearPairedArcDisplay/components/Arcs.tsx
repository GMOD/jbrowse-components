import { Suspense, lazy, useState } from 'react'

import {
  getContainingView,
  getSession,
  getStrokeProps,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { makeSummary } from './util.ts'

import type { LinearPairedArcDisplayModel } from '../model.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const ArcTooltip = lazy(() => import('../../ArcTooltip.tsx'))

type LGV = LinearGenomeViewModel
type ArcStyle = NonNullable<LinearPairedArcDisplayModel['arcStyles']>[number]

const Arc = observer(function Arc({
  model,
  style,
  assembly,
  view,
  lineWidth,
  hoverColor,
  exportSVG,
}: {
  model: LinearPairedArcDisplayModel
  style: ArcStyle
  assembly: Assembly
  view: LGV
  lineWidth: number
  hoverColor: string
  exportSVG?: boolean
}) {
  const [mouseOvered, setMouseOvered] = useState(false)
  const { feature, alt, color, k1, k2 } = style
  const ra1 = assembly.getCanonicalRefName(k1.refName) || k1.refName
  const ra2 = assembly.getCanonicalRefName(k2.refName) || k2.refName
  const r1 = view.bpToPx({ refName: ra1, coord: k1.start })?.offsetPx
  const r2 = view.bpToPx({ refName: ra2, coord: k2.start })?.offsetPx

  if (r1 === undefined || r2 === undefined) {
    return null
  }

  const left = r1 - view.offsetPx
  const right = r2 - view.offsetPx
  const absrad = Math.abs((right - left) / 2)
  if (absrad <= 1) {
    return null
  }
  // mate-direction ticks extend 20px past each endpoint
  if (
    !exportSVG &&
    (Math.max(left, right) < -20 || Math.min(left, right) > view.width + 20)
  ) {
    return null
  }

  const destY = Math.min(model.height, absrad)
  // hover emphasis: contrast against the track background in either theme
  const col = mouseOvered ? hoverColor : color
  const events = {
    onMouseLeave: () => {
      setMouseOvered(false)
    },
    onMouseOver: () => {
      setMouseOvered(true)
    },
    onClick: () => {
      model.selectFeature(feature)
    },
  }

  return (
    <>
      <path
        d={`M ${left} 0 C ${left} ${destY}, ${right} ${destY}, ${right} 0`}
        {...getStrokeProps(col)}
        strokeWidth={lineWidth}
        {...events}
        fill="none"
        pointerEvents="stroke"
      />
      {k1.mateDirection ? (
        <line
          {...getStrokeProps(col)}
          strokeWidth={lineWidth}
          {...events}
          x1={left}
          x2={left + k1.mateDirection * 20}
          y1={1.5}
          y2={1.5}
        />
      ) : null}
      {k2.mateDirection ? (
        <line
          {...getStrokeProps(col)}
          strokeWidth={lineWidth}
          {...events}
          x1={right}
          x2={right + k2.mateDirection * 20}
          y1={1.5}
          y2={1.5}
        />
      ) : null}
      {mouseOvered ? (
        <Suspense fallback={null}>
          <ArcTooltip contents={makeSummary(feature, alt)} />
        </Suspense>
      ) : null}
    </>
  )
})

const Arcs = observer(function Arcs({
  model,
  exportSVG,
}: {
  model: LinearPairedArcDisplayModel
  exportSVG?: boolean
}) {
  const view = getContainingView(model) as LGV
  const { assemblyManager } = getSession(model)
  const { arcStyles, height, lineWidth } = model
  const assembly = assemblyManager.get(view.assemblyNames[0]!)
  // resolved once here rather than per arc — every <Arc> would otherwise
  // subscribe to theme context on its own to compute this one color
  const hoverColor = useTheme().palette.text.primary

  if (!assembly) {
    return null
  }

  const arcs = arcStyles?.map(style => (
    <Arc
      key={`${style.feature.id()}-${style.alt ?? ''}`}
      model={model}
      style={style}
      view={view}
      assembly={assembly}
      lineWidth={lineWidth}
      hoverColor={hoverColor}
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
