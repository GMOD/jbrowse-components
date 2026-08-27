import { getStrokeProps } from '@jbrowse/core/util'
import { breakendTickPx } from '@jbrowse/sv-core'
import { observer } from 'mobx-react'

import ArcGlyph from '../../shared/ArcGlyph.tsx'
import ArcsContainer from '../../shared/ArcsContainer.tsx'
import { makeSummary } from './util.ts'

import type { LinearPairedArcDisplayModel } from '../model.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel
type ArcStyle = NonNullable<LinearPairedArcDisplayModel['arcStyles']>[number]

// mate-direction ticks extend 20px past each endpoint
const TICK_PX = 20

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
  const { feature, alt, color, k1, k2 } = style
  const ra1 = assembly.getCanonicalRefName2(k1.refName)
  const ra2 = assembly.getCanonicalRefName2(k2.refName)
  const p1 = view.bpToPx({ refName: ra1, coord: k1.start })
  const p2 = view.bpToPx({ refName: ra2, coord: k2.start })

  if (p1 === undefined || p2 === undefined) {
    return null
  }

  const left = p1.offsetPx - view.offsetPx
  const right = p2.offsetPx - view.offsetPx
  // `mateDirection` is genomic, and these are screen coordinates. Asked per
  // region rather than off the view, because that is what bpToPx resolved the
  // endpoint through and a session may reverse one region and not another.
  const rev1 = !!view.displayedRegions[p1.index]?.reversed
  const rev2 = !!view.displayedRegions[p2.index]?.reversed
  const absrad = Math.abs((right - left) / 2)
  if (absrad <= 1) {
    return null
  }
  const destY = Math.min(model.height, absrad)

  return (
    <ArcGlyph
      model={model}
      feature={feature}
      left={left}
      right={right}
      viewWidth={view.width}
      cullMargin={TICK_PX}
      tooltip={makeSummary(feature, alt)}
      exportSVG={exportSVG}
    >
      {(hovered, events) => {
        const stroke = getStrokeProps(hovered ? hoverColor : color)
        return (
          <>
            <path
              d={`M ${left} 0 C ${left} ${destY}, ${right} ${destY}, ${right} 0`}
              {...stroke}
              strokeWidth={lineWidth}
              {...events}
              fill="none"
            />
            {k1.mateDirection ? (
              <line
                {...stroke}
                strokeWidth={lineWidth}
                {...events}
                x1={left}
                x2={breakendTickPx(left, k1.mateDirection, rev1)}
                y1={1.5}
                y2={1.5}
              />
            ) : null}
            {k2.mateDirection ? (
              <line
                {...stroke}
                strokeWidth={lineWidth}
                {...events}
                x1={right}
                x2={breakendTickPx(right, k2.mateDirection, rev2)}
                y1={1.5}
                y2={1.5}
              />
            ) : null}
          </>
        )
      }}
    </ArcGlyph>
  )
})

const Arcs = observer(function Arcs({
  model,
  exportSVG,
}: {
  model: LinearPairedArcDisplayModel
  exportSVG?: boolean
}) {
  const { arcStyles, lineWidth } = model
  return (
    <ArcsContainer model={model} exportSVG={exportSVG}>
      {(assembly, view, hoverColor) =>
        arcStyles?.map(style => (
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
      }
    </ArcsContainer>
  )
})

export default Arcs
