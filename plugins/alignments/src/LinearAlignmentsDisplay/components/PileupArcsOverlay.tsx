import { useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { computePileupArcs } from './computePileupArcs.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const PileupArcsOverlay = observer(function PileupArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const [selectedArcIdx, setSelectedArcIdx] = useState(-1)
  const view = getContainingView(model) as LinearGenomeViewModel
  const {
    showLinkedReads,
    showLinkedReadsAsBeziers,
    laidOutPileupMap,
    featureHeightSetting: featureHeight,
    featureSpacing,
    coverageDisplayHeight: pileupTopOffset,
    currentRangeY: rangeY,
    pileupViewportHeight: viewportH,
    height,
  } = model
  const { initialized, offsetPx, visibleRegions, width } = view

  if (!showLinkedReads || !showLinkedReadsAsBeziers || !initialized) {
    return null
  }

  const arcs = computePileupArcs({
    laidOutPileupMap,
    visibleRegions,
    bpToScreenX: (refName, bp) => {
      const r = view.bpToPx({ refName, coord: bp })
      return r === undefined ? undefined : r.offsetPx - offsetPx
    },
    featureHeight,
    featureSpacing,
    pileupTopOffset,
    rangeY,
    viewportH,
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
      {arcs.map((arc, i) => {
        const isSelected = i === selectedArcIdx
        return (
          <path
            key={i}
            d={arc.d}
            stroke={arc.stroke}
            strokeWidth={isSelected ? 3 : 1.5}
            strokeOpacity={0.8}
            fill="none"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onMouseEnter={() => {
              const info1 = model.getFeatureInfoById(arc.id1)
              const info2 = model.getFeatureInfoById(arc.id2)
              if (info1 || info2) {
                const parts = [info1, info2]
                  .filter(Boolean)
                  .map(
                    info =>
                      `${info!.name || info!.id} ${info!.refName}:${info!.start.toLocaleString()}-${info!.end.toLocaleString()}`,
                  )
                model.setMouseoverExtraInformation(parts.join(' → '))
              }
            }}
            onMouseLeave={() => {
              model.clearMouseoverState()
            }}
            onClick={() => {
              setSelectedArcIdx(isSelected ? -1 : i)
              void model.selectFeatureById(arc.id1)
            }}
          />
        )
      })}
    </svg>
  )
})

export default PileupArcsOverlay
