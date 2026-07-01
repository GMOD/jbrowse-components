import { useState } from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import SashimiArcLabel from './SashimiArcLabel.tsx'
import { openSashimiWidget } from './detailWidgets.ts'
import { computeSashimiArcsFromModel, sashimiArcKey } from './sashimiArcs.ts'
import { bandScreenTop } from './sectionScreen.ts'
import { formatSashimiTooltip } from './tooltipUtils.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// One side's worth of arcs as an absolutely-positioned SVG at the (scrolled)
// sub-band top. Up arcs overlay the coverage band (overflow visible so a tall
// arc can rise into it); down arcs sit in their own reserved strip and clip to
// it. Native per-path hover/click means each band resolves its own events.
const SashimiSubBand = observer(function SashimiSubBand({
  model,
  arcs,
  screenTop,
  height,
  width,
  clip,
  selectedArcKey,
  onSelect,
}: {
  model: LinearAlignmentsDisplayModel
  arcs: SashimiArc[]
  screenTop: number
  height: number
  width: number
  clip: boolean
  selectedArcKey: string | null
  onSelect: (key: string | null) => void
}) {
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
        height,
        width,
        overflow: clip ? 'hidden' : 'visible',
      }}
    >
      {arcs.map(arc => {
        const arcKey = sashimiArcKey(arc)
        const isSelected = arcKey === selectedArcKey
        return (
          <g key={arcKey}>
            <path
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
            {arc.showLabel && model.showSashimiLabels ? (
              <SashimiArcLabel
                x={arc.labelX}
                y={arc.labelY}
                score={arc.score}
              />
            ) : null}
          </g>
        )
      })}
    </svg>
  )
})

// One stacked section's sashimi arcs, split into the up band (over coverage) and
// the down band (reserved strip below it). 'auto' renders both at once.
const SashimiBand = observer(function SashimiBand({
  model,
  view,
  rpcDataMap,
  coverageScreenTop,
  sashimiScreenTop,
  selectedArcKey,
  onSelect,
}: {
  model: LinearAlignmentsDisplayModel
  view: LinearGenomeViewModel
  rpcDataMap: ReadonlyMap<number, PileupDataResult>
  coverageScreenTop: number
  sashimiScreenTop: number
  selectedArcKey: string | null
  onSelect: (key: string | null) => void
}) {
  const arcs = computeSashimiArcsFromModel(model, view, rpcDataMap)
  return (
    <>
      <SashimiSubBand
        model={model}
        arcs={arcs.filter(a => a.side === 'up')}
        screenTop={coverageScreenTop}
        height={model.coverageHeight - YSCALEBAR_LABEL_OFFSET}
        width={view.width}
        clip={false}
        selectedArcKey={selectedArcKey}
        onSelect={onSelect}
      />
      <SashimiSubBand
        model={model}
        arcs={arcs.filter(a => a.side === 'down')}
        screenTop={sashimiScreenTop}
        height={model.sashimiArcsHeight}
        width={view.width}
        clip
        selectedArcKey={selectedArcKey}
        onSelect={onSelect}
      />
    </>
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

  // Ungrouped coverage is sticky (only the pileup scrolls), so its bands keep
  // their content-space tops; grouped sections scroll as a unit.
  const { scrollModel: scroll } = model
  return (
    <>
      {model.sashimiSections.map(section => (
        <SashimiBand
          key={section.groupKey}
          model={model}
          view={view}
          rpcDataMap={section.rpcDataMap}
          coverageScreenTop={bandScreenTop(section.coverageOverlayTop, scroll)}
          sashimiScreenTop={bandScreenTop(section.sashimiBandTop, scroll)}
          selectedArcKey={selectedArcKey}
          onSelect={setSelectedArcKey}
        />
      ))}
    </>
  )
})

export default SashimiArcsOverlay
