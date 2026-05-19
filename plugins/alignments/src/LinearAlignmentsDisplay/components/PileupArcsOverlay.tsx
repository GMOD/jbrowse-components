import { useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { makeBpToScreenX } from './alignmentComponentUtils.ts'
import { computePileupBezierArcs } from '../../features/arcs/computeOverlay.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function arcTooltip(
  model: LinearAlignmentsDisplayModel,
  id1: string,
  id2: string,
) {
  const parts: string[] = []
  for (const id of [id1, id2]) {
    const info = model.getFeatureInfoById(id)
    if (info) {
      parts.push(
        `${info.name || info.id} ${info.refName}:${info.start.toLocaleString()}-${info.end.toLocaleString()}`,
      )
    }
  }
  return parts.length > 0 ? parts.join(' → ') : undefined
}

const PileupArcsOverlay = observer(function PileupArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const [selectedArcId, setSelectedArcId] = useState<string | null>(null)
  const view = getContainingView(model) as LinearGenomeViewModel
  const {
    linkedReads,
    pairedArcs,
    laidOutPileupMap,
    featureHeightSetting: featureHeight,
    featureSpacing,
    coverageDisplayHeight: pileupTopOffset,
    currentRangeY: rangeY,
    pileupViewportHeight: viewportH,
    height,
  } = model
  const { initialized, displayedRegions, width } = view

  if (linkedReads !== 'bezier' || !initialized) {
    return null
  }

  const arcs = computePileupBezierArcs({
    laidOutPileupMap,
    displayedRegions,
    bpToScreenX: makeBpToScreenX(view),
    featureHeight,
    featureSpacing,
    pileupTopOffset,
    rangeY,
    viewportH,
    pairedArcsDown: pairedArcs === 'down',
  })

  if (!arcs.length) {
    return null
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
        overflow: 'hidden',
      }}
    >
      {arcs.map(arc => {
        const arcId = `${arc.id1}:${arc.id2}`
        const isSelected = arcId === selectedArcId
        return (
          <path
            key={arcId}
            d={arc.d}
            stroke={arc.stroke}
            strokeWidth={isSelected ? 3 : 1.5}
            strokeOpacity={0.8}
            fill="none"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onMouseEnter={() => {
              const tooltip = arcTooltip(model, arc.id1, arc.id2)
              if (tooltip) {
                model.setMouseoverExtraInformation(tooltip)
              }
            }}
            onMouseLeave={() => {
              model.clearMouseoverState()
            }}
            onClick={() => {
              setSelectedArcId(isSelected ? null : arcId)
              void model.selectFeatureById(arc.id1)
            }}
          />
        )
      })}
    </svg>
  )
})

export default PileupArcsOverlay
