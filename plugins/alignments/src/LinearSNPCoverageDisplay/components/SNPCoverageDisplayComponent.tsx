import { getContainingView } from '@jbrowse/core/util'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'
import { observer } from 'mobx-react'

import type { SNPCoverageDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface ArcData {
  id: string
  path: string
  stroke: string
  strokeWidth: number
  start: number
  end: number
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

const Arcs = observer(function ({ model }: { model: SNPCoverageDisplayModel }) {
  const { skipFeatures, showArcsSetting, height } = model
  const view = getContainingView(model) as LGV

  if (!showArcsSetting || !view.initialized) {
    return null
  }

  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const arcs: ArcData[] = []

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

    // Create bezier curve path: M left,height C left,0 right,0 right,height
    const path = `M ${left} ${height} C ${left} 0, ${right} 0, ${right} ${height}`

    arcs.push({
      id: feature.id(),
      path,
      stroke: getArcColor(effectiveStrand),
      strokeWidth: Math.log(score + 1),
      start,
      end,
      score,
      effectiveStrand,
    })
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        height,
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
          onClick={() => {
            // Handle arc click - could show a dialog or tooltip
            console.log('Arc clicked:', {
              start: arc.start,
              end: arc.end,
              score: arc.score,
              strand: arc.effectiveStrand,
            })
          }}
        />
      ))}
    </svg>
  )
})

const SNPCoverageDisplayComponent = observer(function (props: {
  model: SNPCoverageDisplayModel
}) {
  const { model } = props

  return (
    <div>
      <LinearWiggleDisplayReactComponent {...props} />
      <Arcs model={model} />
    </div>
  )
})

export default SNPCoverageDisplayComponent
