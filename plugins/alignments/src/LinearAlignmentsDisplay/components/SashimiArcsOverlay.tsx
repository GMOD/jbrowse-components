import { Fragment, useState } from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { getContainingView } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import SashimiArcLabel from './SashimiArcLabel.tsx'
import { openSashimiWidget } from './detailWidgets.ts'
import { sashimiArcKey, sashimiSelectionKey } from './sashimiArcs.ts'
import { bandScreenTop } from './sectionScreen.ts'
import { formatSashimiTooltip } from './tooltipUtils.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// One side's worth of arcs as an absolutely-positioned SVG at the (scrolled)
// sub-band top. Up arcs overlay the coverage band (overflow visible so a tall
// arc can rise into it); down arcs sit in their own reserved strip and clip to
// it. Native per-path hover/click means each band resolves its own events.
//
// Hover just widens the stroke: it's plain React state, not an imperative
// setAttribute. Arc geometry is memoized on the model (`sashimiArcSections`), so
// hovering repaints only this band's (low count) paths without recomputing it.
const SashimiSubBand = observer(function SashimiSubBand({
  model,
  arcs,
  groupKey,
  screenTop,
  height,
  width,
  clip,
  selectedArcKey,
  onSelect,
}: {
  model: LinearAlignmentsDisplayModel
  arcs: SashimiArc[]
  groupKey: string
  screenTop: number
  height: number
  width: number
  clip: boolean
  selectedArcKey: string | null
  onSelect: (key: string | null) => void
}) {
  const [hoveredArcKey, setHoveredArcKey] = useState<string | null>(null)
  const theme = useTheme()
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
        const selKey = sashimiSelectionKey(groupKey, arc)
        const isSelected = selKey === selectedArcKey
        const wide = isSelected || arcKey === hoveredArcKey
        return (
          <g key={arcKey}>
            <path
              d={arc.d}
              // Selection recolors to the theme's primary text color, which
              // inverts with the palette — the old hardcoded '#333' vanished
              // against the dark-mode track background.
              stroke={isSelected ? theme.palette.text.primary : arc.stroke}
              strokeWidth={wide ? arc.strokeWidth + 2 : arc.strokeWidth}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredArcKey(arcKey)
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
              onMouseLeave={() => {
                setHoveredArcKey(null)
                model.clearMouseoverState()
              }}
              onClick={() => {
                onSelect(isSelected ? null : selKey)
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

// Each stacked section contributes two sub-bands: `up` over the coverage
// histogram and `down` in the reserved strip below it. 'auto' fills both at
// once; 'up'/'down' leave the other empty (and an empty sub-band renders null).
// `sashimiArcSections` is [] when sashimi is off or the view hasn't initialized.
const SashimiArcsOverlay = observer(function SashimiArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const [selectedArcKey, setSelectedArcKey] = useState<string | null>(null)
  const { width } = getContainingView(model) as LinearGenomeViewModel
  // Ungrouped coverage is sticky (only the pileup scrolls), so its bands keep
  // their content-space tops; grouped sections scroll as a unit.
  const { scrollModel: scroll } = model
  return (
    <>
      {model.sashimiArcSections.map(section => (
        <Fragment key={section.groupKey}>
          <SashimiSubBand
            model={model}
            arcs={section.up}
            groupKey={section.groupKey}
            screenTop={bandScreenTop(section.coverageOverlayTop, scroll)}
            height={model.coverageHeight - YSCALEBAR_LABEL_OFFSET}
            width={width}
            clip={false}
            selectedArcKey={selectedArcKey}
            onSelect={setSelectedArcKey}
          />
          <SashimiSubBand
            model={model}
            arcs={section.down}
            groupKey={section.groupKey}
            screenTop={bandScreenTop(section.sashimiBandTop, scroll)}
            height={model.sashimiArcsHeight}
            width={width}
            clip
            selectedArcKey={selectedArcKey}
            onSelect={setSelectedArcKey}
          />
        </Fragment>
      ))}
    </>
  )
})

export default SashimiArcsOverlay
