import { useMemo, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'
import { observer } from 'mobx-react'

import type { Feature } from '@jbrowse/core/util'
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
  strand: number
}

function getArcColor(strand: number) {
  return strand === 1
    ? 'rgba(255,200,200,0.7)'
    : strand === -1
      ? 'rgba(200,200,255,0.7)'
      : 'rgba(200,200,200,0.7)'
}

function getStrandLabel(strand: number) {
  return strand === 1 ? '+' : strand === -1 ? '-' : 'unknown'
}

function featureToArcData(
  feature: Feature,
  view: LGV,
  effectiveHeight: number,
  offsetPx: number,
): ArcData | undefined {
  const start = feature.get('start')
  const end = feature.get('end')
  const refName = feature.get('refName')

  const startPx = view.bpToPx({ refName, coord: start })
  const endPx = view.bpToPx({ refName, coord: end })

  if (startPx === undefined || endPx === undefined) {
    return undefined
  }

  const left = startPx.offsetPx - offsetPx
  const right = endPx.offsetPx - offsetPx
  const strand = feature.get('effectiveStrand') ?? 0
  const score = feature.get('score') ?? 1

  return {
    id: feature.id(),
    path: `M ${left} ${effectiveHeight} C ${left} 0, ${right} 0, ${right} ${effectiveHeight}`,
    stroke: getArcColor(strand),
    strokeWidth: Math.log(score + 1),
    start,
    end,
    refName,
    score,
    strand,
  }
}

function ArcTooltipContents({ arc }: { arc: ArcData }) {
  return (
    <div>
      <div>
        <strong>Intron/Skip</strong>
      </div>
      <div>
        Location: {arc.refName}:{arc.start.toLocaleString()}-
        {arc.end.toLocaleString()}
      </div>
      <div>Length: {(arc.end - arc.start).toLocaleString()} bp</div>
      <div>Reads supporting junction: {arc.score}</div>
      <div>Strand: {getStrandLabel(arc.strand)}</div>
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

  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const effectiveHeight = height - YSCALEBAR_LABEL_OFFSET * 2

  // Memoize arc computation - only recompute when features or bpPerPx change
  // Track the offsetPx at which arcs were computed for proper positioning
  const { arcs, drawnAtBpPerPx, drawnAtOffsetPx } = useMemo(() => {
    const currentOffsetPx = view.offsetPx
    const arcs = skipFeatures
      .map(f => featureToArcData(f, view, effectiveHeight, currentOffsetPx))
      .filter((arc): arc is ArcData => arc !== undefined)
    return {
      arcs,
      drawnAtBpPerPx: view.bpPerPx,
      drawnAtOffsetPx: currentOffsetPx,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipFeatures, view.bpPerPx, effectiveHeight])

  if (!showArcsSetting || !view.initialized) {
    return null
  }

  // Don't render if bpPerPx changed (zoom) - arcs are invalid until recomputed
  if (drawnAtBpPerPx !== view.bpPerPx) {
    return null
  }

  // Offset the SVG based on difference between when arcs were drawn and current position
  const left = drawnAtOffsetPx - view.offsetPx

  return (
    <>
      <svg
        style={{
          position: 'absolute',
          top: YSCALEBAR_LABEL_OFFSET,
          left,
          pointerEvents: 'none',
          height: effectiveHeight,
          width,
        }}
      >
        {arcs.map(arc => (
          <path
            key={`${arc.refName}-${arc.start}-${arc.end}-${arc.strand}`}
            d={arc.path}
            stroke={arc.stroke}
            strokeWidth={arc.strokeWidth}
            fill="none"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onMouseEnter={event => {
              setHoverInfo({ arc, x: event.clientX, y: event.clientY })
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
