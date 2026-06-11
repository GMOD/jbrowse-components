import { useState } from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { openSashimiWidget } from './openFeatureWidget.ts'
import { computeSashimiArcsFromModel, sashimiArcKey } from './sashimiArcs.ts'
import { formatSashimiTooltip } from './tooltipUtils.ts'

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
    showSashimiArcs,
    readConnectionsDown,
    showCoverage,
    coverageHeight,
    sashimiArcsHeight,
    rpcDataMap,
  } = model
  const { initialized, width } = view

  if (!showSashimiArcs || !showCoverage || !initialized) {
    return null
  }

  const isDown = readConnectionsDown
  const arcs = computeSashimiArcsFromModel(model, view, rpcDataMap)

  return (
    <svg
      style={{
        position: 'absolute',
        top: model.sashimiArcsTop,
        left: 0,
        pointerEvents: 'none',
        height: isDown
          ? sashimiArcsHeight
          : coverageHeight - YSCALEBAR_LABEL_OFFSET,
        width,
        overflow: isDown ? 'hidden' : 'visible',
      }}
    >
      {arcs.map(arc => {
        const arcKey = sashimiArcKey(arc)
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
