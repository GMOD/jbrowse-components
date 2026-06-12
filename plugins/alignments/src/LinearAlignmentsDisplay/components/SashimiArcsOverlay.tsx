import { useState } from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { openSashimiWidget } from './openFeatureWidget.ts'
import { computeSashimiArcsFromModel, sashimiArcKey } from './sashimiArcs.ts'
import { formatSashimiTooltip } from './tooltipUtils.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// One stacked section's sashimi band: an absolutely-positioned SVG at the
// section's (scrolled) band top, holding that group's junction arcs. Native
// per-path hover/click means each band resolves its own events — no screen-Y
// section hit-test needed. Selection key is shared across bands (arc keys are
// globally unique by ref:start:end:strand).
const SashimiBand = observer(function SashimiBand({
  model,
  view,
  rpcDataMap,
  screenTop,
  selectedArcKey,
  onSelect,
}: {
  model: LinearAlignmentsDisplayModel
  view: LinearGenomeViewModel
  rpcDataMap: ReadonlyMap<number, PileupDataResult>
  screenTop: number
  selectedArcKey: string | null
  onSelect: (key: string | null) => void
}) {
  const isDown = model.readConnectionsDown
  const arcs = computeSashimiArcsFromModel(model, view, rpcDataMap)
  if (!arcs.length) {
    return null
  }
  return (
    <svg
      style={{
        position: 'absolute',
        top: screenTop,
        left: 0,
        pointerEvents: 'none',
        height: isDown
          ? model.sashimiArcsHeight
          : model.coverageHeight - YSCALEBAR_LABEL_OFFSET,
        width: view.width,
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
              onSelect(isSelected ? null : arcKey)
              openSashimiWidget(model, arc)
            }}
          />
        )
      })}
    </svg>
  )
})

const SashimiArcsOverlay = observer(function SashimiArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const [selectedArcKey, setSelectedArcKey] = useState<string | null>(null)
  const view = getContainingView(model) as LinearGenomeViewModel
  if (!model.showSashimiArcs || !model.showCoverage || !view.initialized) {
    return null
  }

  // Ungrouped coverage is sticky (only the pileup scrolls), so its band keeps
  // its content-space top; grouped sections scroll as a unit.
  const { isGrouped, scrollTop } = model
  return (
    <>
      {model.sashimiSections.map(section => (
        <SashimiBand
          key={section.groupKey}
          model={model}
          view={view}
          rpcDataMap={section.rpcDataMap}
          screenTop={isGrouped ? section.top - scrollTop : section.top}
          selectedArcKey={selectedArcKey}
          onSelect={setSelectedArcKey}
        />
      ))}
    </>
  )
})

export default SashimiArcsOverlay
