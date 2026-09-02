import { Fragment, useState } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import SashimiArcLabels from './SashimiArcLabels.tsx'
import SashimiSelectionOutline from './SashimiSelectionOutline.tsx'
import { openSashimiWidget } from './detailWidgets.ts'
import {
  SASHIMI_SIDES,
  sashimiArcKey,
  sashimiSelectionKey,
  sashimiSideBand,
} from './sashimiArcs.ts'
import { bandOnScreen, bandScreenTop } from './sectionScreen.ts'
import { formatSashimiTooltip } from './tooltipUtils.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

// One side's worth of arcs as an absolutely-positioned SVG at the (scrolled)
// sub-band top. Native per-path hover/click means each band resolves its own
// events.
//
// The box comes from `sashimiSideBand`, which derives extent and clipping from
// the side — an 'up' band overlays the coverage histogram (overflow visible, so
// a tall arc can rise into it) and a 'down' band is the reserved strip below it,
// clipped to its own height so it can't paint over the pileup.
//
// Hover just widens the stroke, and stays plain React state: it is a
// per-mousemove thing with nothing to export. Selection is the model's
// (`selectedSashimiKey`), so the export can draw the same outline. Arc geometry
// is memoized on the model (`sashimiArcSections`), so hovering repaints only
// this band's (low count) paths without recomputing it.
const SashimiSubBand = observer(function SashimiSubBand({
  model,
  arcs,
  groupKey,
  screenTop,
  height,
  clipped,
  width,
  palette,
}: {
  model: LinearAlignmentsDisplayModel
  arcs: SashimiArc[]
  groupKey: string
  screenTop: number
  height: number
  clipped: boolean
  width: number
  palette: JBrowsePalette
}) {
  const [hoveredArcKey, setHoveredArcKey] = useState<string | null>(null)
  return (
    <svg
      style={{
        position: 'absolute',
        top: screenTop,
        left: 0,
        pointerEvents: 'none',
        height,
        width,
        overflow: clipped ? 'hidden' : 'visible',
      }}
    >
      {arcs.map(arc => {
        const arcKey = sashimiArcKey(arc)
        const selKey = sashimiSelectionKey(groupKey, arc)
        return (
          <Fragment key={arcKey}>
            {selKey === model.selectedSashimiKey ? (
              <SashimiSelectionOutline arc={arc} palette={palette} />
            ) : null}
            <path
              d={arc.d}
              stroke={arc.stroke}
              strokeWidth={
                arcKey === hoveredArcKey ? arc.strokeWidth + 2 : arc.strokeWidth
              }
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredArcKey(arcKey)
                // Through `setHoverState` for the reason the two arc overlays
                // are: it is the write the open context menu's hover pin
                // refuses, so an arc crossed while the menu is up can't
                // overwrite the read the menu acts on.
                model.setHoverState({
                  overCigarItem: false,
                  featureIdUnderMouse: undefined,
                  mouseoverExtraInformation: formatSashimiTooltip(arc),
                  highlightedChainReadIds: [],
                })
              }}
              onMouseLeave={() => {
                setHoveredArcKey(null)
                model.clearMouseoverState()
              }}
              // Select AND open, always — selection marks the junction the
              // detail widget is showing, so a second click on the same arc is
              // idempotent rather than deselecting it while reopening the
              // widget that says it's selected.
              onClick={() => {
                model.setSelectedSashimiKey(selKey)
                openSashimiWidget(model, arc)
              }}
            />
          </Fragment>
        )
      })}
      <SashimiArcLabels
        arcs={arcs}
        show={model.showSashimiLabels}
        palette={palette}
      />
    </svg>
  )
})

// Each stacked section contributes two sub-bands: `up` over the coverage
// histogram and `down` in the reserved strip below it. 'auto' fills both at
// once; 'up'/'down' leave the other empty. `sashimiArcSections` is [] when
// sashimi is off or the view hasn't initialized.
const SashimiArcsOverlay = observer(function SashimiArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const palette = usePalette()
  // Ungrouped coverage is sticky (only the pileup scrolls), so its bands keep
  // their content-space tops; grouped sections scroll as a unit.
  const { scrollModel: scroll, sashimiArcSections: sections } = model
  if (sections.length === 0) {
    return null
  }
  // Read AFTER that gate: `view.width` throws by design before the view is
  // measured, and `sashimiArcSections` is empty until `view.initialized` — so
  // the gate is what makes this read safe, rather than it being safe by
  // accident of nothing mounting the overlay early (the trap
  // `PileupBezierOverlay` documents at length).
  const { width } = model.view
  return sections.flatMap(section =>
    SASHIMI_SIDES.map(side => {
      const arcs = section[side]
      const band = sashimiSideBand(section, side, model)
      const screenTop = bandScreenTop(band.top, scroll)
      // A grouped display re-renders this whole overlay on every scroll frame
      // (each section's screen top moves), so an off-screen lane's paths would
      // be reconciled once per frame for a band nobody can see — the same
      // reason `GroupLabelsOverlay` culls. Not applied to the SVG export, which
      // has no frames and clips to the same box anyway.
      return arcs.length === 0 ||
        !bandOnScreen(screenTop, band.height, scroll) ? null : (
        <SashimiSubBand
          key={`${section.groupKey}-${side}`}
          model={model}
          arcs={arcs}
          groupKey={section.groupKey}
          screenTop={screenTop}
          height={band.height}
          clipped={band.clipped}
          width={width}
          palette={palette}
        />
      )
    }),
  )
})

export default SashimiArcsOverlay
