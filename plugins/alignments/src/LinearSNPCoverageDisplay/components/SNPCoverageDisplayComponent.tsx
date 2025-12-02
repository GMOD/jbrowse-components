import { useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'
import { observer } from 'mobx-react'

import type { SNPCoverageDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const YSCALEBAR_LABEL_OFFSET = 5

interface ArcData {
  id: string
  path: string
  stroke: string
  strokeWidth: number
  start: number
  end: number
  refName: string
  score: number
  effectiveStrand: number
}

function getArcColor(effectiveStrand: number) {
  if (effectiveStrand === 1) {
    return 'rgba(255,200,200,0.7)'
  } else if (effectiveStrand === -1) {
    return 'rgba(200,200,255,0.7)'
  }
  return 'rgba(200,200,200,0.7)'
}

function getStrandLabel(effectiveStrand: number) {
  if (effectiveStrand === 1) {
    return '+'
  } else if (effectiveStrand === -1) {
    return '-'
  }
  return 'unknown'
}

function ArcTooltipContents({ arc }: { arc: ArcData }) {
  const length = arc.end - arc.start
  return (
    <div>
      <div>
        <strong>Intron/Skip</strong>
      </div>
      <div>
        Location: {arc.refName}:{arc.start.toLocaleString()}-
        {arc.end.toLocaleString()}
      </div>
      <div>Length: {length.toLocaleString()} bp</div>
      <div>Reads supporting junction: {arc.score}</div>
      <div>Strand: {getStrandLabel(arc.effectiveStrand)}</div>
    </div>
  )
}

const Arcs = observer(function ({ model }: { model: SNPCoverageDisplayModel }) {
  const { skipFeatures, showArcsSetting, height } = model
  const view = getContainingView(model) as LGV
  const [hoverInfo, setHoverInfo] = useState<{
    arc: ArcData
    x: number
    y: number
  } | null>(null)

  if (!showArcsSetting || !view.initialized) {
    return null
  }

  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const arcs: ArcData[] = []
  const effectiveHeight = height - YSCALEBAR_LABEL_OFFSET * 2

  for (const feature of skipFeatures) {
    const start = feature.get('start')
    const end = feature.get('end')
    const refName = feature.get('refName')

    const startPx = view.bpToPx({ refName, coord: start })
    const endPx = view.bpToPx({ refName, coord: end })

    if (startPx === undefined || endPx === undefined) {
      continue
    }

    const left = startPx.offsetPx - view.offsetPx
    const right = endPx.offsetPx - view.offsetPx
    const effectiveStrand = feature.get('effectiveStrand') ?? 0
    const score = feature.get('score') ?? 1

    // Create bezier curve path within the effective height area
    const path = `M ${left} ${effectiveHeight} C ${left} 0, ${right} 0, ${right} ${effectiveHeight}`

    arcs.push({
      id: feature.id(),
      path,
      stroke: getArcColor(effectiveStrand),
      strokeWidth: Math.log(score + 1),
      start,
      end,
      refName,
      score,
      effectiveStrand,
    })
  }

  return (
    <>
      <svg
        style={{
          position: 'absolute',
          top: YSCALEBAR_LABEL_OFFSET,
          left: 0,
          pointerEvents: 'none',
          height: effectiveHeight,
          width,
        }}
      >
        {arcs.map(arc => (
          <path
            key={arc.id}
            d={arc.path}
            stroke={arc.stroke}
            strokeWidth={arc.strokeWidth}
            fill="none"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onMouseEnter={event => {
              setHoverInfo({
                arc,
                x: event.clientX,
                y: event.clientY,
              })
            }}
            onMouseLeave={() => {
              setHoverInfo(null)
            }}
          />
        ))}
      </svg>
      {hoverInfo ? (
        <BaseTooltip clientPoint={{ x: hoverInfo.x + 5, y: hoverInfo.y }}>
          <ArcTooltipContents arc={hoverInfo.arc} />
        </BaseTooltip>
      ) : null}
    </>
  )
})

const SNPCoverageDisplayComponent = observer(function (props: {
  model: SNPCoverageDisplayModel
}) {
  const { model } = props

  return (
    <div style={{ position: 'relative' }}>
      <LinearWiggleDisplayReactComponent {...props} />
      <Arcs model={model} />
    </div>
  )
})

export default SNPCoverageDisplayComponent
