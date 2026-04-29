import { useState } from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { formatSashimiTooltip } from './alignmentComponentUtils.ts'
import { openSashimiWidget } from './openFeatureWidget.ts'
import { computeSashimiArcs } from '../../features/sashimi/computeOverlay.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const SashimiArcsOverlay = observer(function SashimiArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const [selectedArcIdx, setSelectedArcIdx] = useState(-1)
  const view = getContainingView(model) as LinearGenomeViewModel
  const {
    showSashimiArcs,
    showCoverage,
    coverageHeight,
    sashimiArcsDown,
    sashimiArcsHeight,
    rpcDataMap,
  } = model
  const { initialized, offsetPx, visibleRegions, width } = view

  if (!showSashimiArcs || !showCoverage || !initialized) {
    return null
  }

  const arcs = computeSashimiArcs({
    rpcDataMap,
    visibleRegions,
    bpToScreenX: (refName, bp) => {
      const r = view.bpToPx({ refName, coord: bp })
      return r === undefined ? undefined : r.offsetPx - offsetPx
    },
    coverageHeight,
    sashimiArcsHeight,
    sashimiArcsDown,
  })

  // Sort by score so high-count arcs paint on top of low-count ones.
  arcs.sort((a, b) => a.score - b.score)

  const effectiveHeight = coverageHeight - YSCALEBAR_LABEL_OFFSET

  return (
    <svg
      style={{
        position: 'absolute',
        top: sashimiArcsDown ? coverageHeight : YSCALEBAR_LABEL_OFFSET,
        left: 0,
        pointerEvents: 'none',
        height: sashimiArcsDown ? sashimiArcsHeight : effectiveHeight,
        width,
        overflow: sashimiArcsDown ? 'hidden' : 'visible',
      }}
    >
      {arcs.map((arc, i) => {
        const isSelected = i === selectedArcIdx
        return (
          <path
            key={i}
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
              setSelectedArcIdx(isSelected ? -1 : i)
              openSashimiWidget(model, arc)
            }}
          />
        )
      })}
    </svg>
  )
})

export default SashimiArcsOverlay
