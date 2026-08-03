import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { useState } from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import SashimiArcLabels from './SashimiArcLabels.tsx'
import { openSashimiWidget } from './detailWidgets.ts'
import {
  SASHIMI_SIDES,
  sashimiArcKey,
  sashimiSelectionKey,
  sashimiSideTop,
} from './sashimiArcs.ts'
import { bandScreenTop } from './sectionScreen.ts'
import { formatSashimiTooltip } from './tooltipUtils.ts'

import type {
  SashimiArc,
  SashimiSide,
} from '../../features/sashimi/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// One side's worth of arcs as an absolutely-positioned SVG at the (scrolled)
// sub-band top. Native per-path hover/click means each band resolves its own
// events.
//
// The band's extent and clipping follow from `side`, so they are derived here
// rather than passed: an 'up' band overlays the coverage histogram (overflow
// visible, so a tall arc can rise into it) and a 'down' band is the reserved
// strip below it, clipped to its own height. As props, nothing stopped a caller
// pairing the down band with the coverage height.
//
// Hover just widens the stroke: it's plain React state, not an imperative
// setAttribute. Arc geometry is memoized on the model (`sashimiArcSections`), so
// hovering repaints only this band's (low count) paths without recomputing it.
const SashimiSubBand = observer(function SashimiSubBand({
  model,
  side,
  arcs,
  groupKey,
  screenTop,
  selectedArcKey,
  onSelect,
}: {
  model: LinearAlignmentsDisplayModel
  side: SashimiSide
  arcs: SashimiArc[]
  groupKey: string
  screenTop: number
  selectedArcKey: string | null
  onSelect: (key: string | null) => void
}) {
  const [hoveredArcKey, setHoveredArcKey] = useState<string | null>(null)
  const palette = usePalette()
  const { width } = getContainingView(model) as LinearGenomeViewModel
  const isDown = side === 'down'
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
        width,
        overflow: isDown ? 'hidden' : 'visible',
      }}
    >
      {arcs.map(arc => {
        const arcKey = sashimiArcKey(arc)
        const selKey = sashimiSelectionKey(groupKey, arc)
        const isSelected = selKey === selectedArcKey
        const wide = isSelected || arcKey === hoveredArcKey
        return (
          <path
            key={arcKey}
            d={arc.d}
            // Selection recolors to the palette's primary text color, which
            // inverts with the palette — the old hardcoded '#333' vanished
            // against the dark-mode track background.
            stroke={isSelected ? palette.text.primary : arc.stroke}
            strokeWidth={wide ? arc.strokeWidth + 2 : arc.strokeWidth}
            fill="none"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onMouseEnter={() => {
              setHoveredArcKey(arcKey)
              model.setMouseoverExtraInformation(formatSashimiTooltip(arc))
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
        )
      })}
      <SashimiArcLabels arcs={arcs} show={model.showSashimiLabels} />
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
  // Ungrouped coverage is sticky (only the pileup scrolls), so its bands keep
  // their content-space tops; grouped sections scroll as a unit.
  const { scrollModel: scroll } = model
  return model.sashimiArcSections.flatMap(section =>
    SASHIMI_SIDES.map(side => (
      <SashimiSubBand
        key={`${section.groupKey}-${side}`}
        model={model}
        side={side}
        arcs={section[side]}
        groupKey={section.groupKey}
        screenTop={bandScreenTop(sashimiSideTop(section, side), scroll)}
        selectedArcKey={selectedArcKey}
        onSelect={key => {
          setSelectedArcKey(key)
        }}
      />
    )),
  )
})

export default SashimiArcsOverlay
