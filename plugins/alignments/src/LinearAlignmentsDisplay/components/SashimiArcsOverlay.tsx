import { useState } from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { makeBpToScreenX } from './alignmentComponentUtils.ts'
import { openSashimiWidget } from './openFeatureWidget.ts'
import { formatSashimiTooltip } from './tooltipUtils.ts'
import { computeSashimiArcs } from '../../features/sashimi/computeOverlay.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const SashimiArcsOverlay = observer(function SashimiArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const [selectedArcKey, setSelectedArcKey] = useState<string | null>(null)
  const view = getContainingView(model) as LinearGenomeViewModel
  const {
    sashimiArcs,
    showCoverage,
    coverageHeight,
    sashimiArcsHeight,
    rpcDataMap,
  } = model
  const { initialized, visibleRegions, width } = view

  if (sashimiArcs === 'off' || !showCoverage || !initialized) {
    return null
  }

  const isDown = sashimiArcs === 'down'
  const arcs = computeSashimiArcs({
    rpcDataMap,
    visibleRegions,
    bpToScreenX: makeBpToScreenX(view),
    coverageHeight,
    sashimiArcsHeight,
    sashimiArcsDown: isDown,
  })

  // Sort by score so high-count arcs paint on top of low-count ones.
  arcs.sort((a, b) => a.score - b.score)

  const effectiveHeight = coverageHeight - YSCALEBAR_LABEL_OFFSET

  return (
    <svg
      style={{
        position: 'absolute',
        top: isDown ? coverageHeight : YSCALEBAR_LABEL_OFFSET,
        left: 0,
        pointerEvents: 'none',
        height: isDown ? sashimiArcsHeight : effectiveHeight,
        width,
        overflow: isDown ? 'hidden' : 'visible',
      }}
    >
      {arcs.map(arc => {
        const arcKey = `${arc.refName}:${arc.start}:${arc.end}`
        const isSelected = arcKey === selectedArcKey
        return (
          <path
            key={arcKey}
            d={arc.d}
            stroke={isSelected ? '#333' : arc.stroke}
            strokeWidth={isSelected ? arc.strokeWidth + 2 : arc.strokeWidth}
            fill="none"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onMouseEnter={e => {
              e.currentTarget.setAttribute(
                'stroke-width',
                String(arc.strokeWidth + 2),
              )
              model.setMouseoverExtraInformation(
                formatSashimiTooltip({
                  start: arc.start,
                  end: arc.end,
                  score: arc.score,
                  strand: arc.strand,
                  refName: arc.refName,
                }),
              )
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                e.currentTarget.setAttribute(
                  'stroke-width',
                  String(arc.strokeWidth),
                )
              }
              model.clearMouseoverState()
            }}
            onClick={() => {
              setSelectedArcKey(isSelected ? null : arcKey)
              openSashimiWidget(model, arc)
            }}
          />
        )
      })}
    </svg>
  )
})

export default SashimiArcsOverlay
