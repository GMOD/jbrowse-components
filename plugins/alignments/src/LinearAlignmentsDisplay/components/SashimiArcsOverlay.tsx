import { Fragment, useState } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import { sashimiArcColor } from '../../features/sashimi/computeOverlay.ts'
import SashimiArcLabels from './SashimiArcLabels.tsx'
import { openSashimiWidget } from './detailWidgets.ts'
import { PAN_MOVED } from './panState.ts'
import {
  SASHIMI_SIDES,
  sashimiArcKey,
  sashimiFeatureId,
  sashimiSideBand,
} from './sashimiArcs.ts'
import { bandOnScreen, bandScreenTop } from './sectionScreen.ts'
import { formatSashimiTooltip } from './tooltipUtils.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

// One side's arcs as an absolutely-positioned SVG at the sub-band's screen top,
// each path resolving its own hover and click. Hover widens the stroke and
// lights the junction's supporting reads; the selected junction is outlined
// under its arc so it keeps its strand tint.
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
        return (
          <Fragment key={arcKey}>
            {sashimiFeatureId(groupKey, arc) === model.selectedFeatureId ? (
              <path
                d={arc.d}
                stroke={palette.text.primary}
                strokeWidth={arc.strokeWidth + 4}
                fill="none"
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
            <path
              d={arc.d}
              stroke={sashimiArcColor(arc.strand, palette.alignmentFill)}
              strokeWidth={
                arcKey === hoveredArcKey ? arc.strokeWidth + 2 : arc.strokeWidth
              }
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredArcKey(arcKey)
                // through `setHoverState`, the write an open context menu's
                // hover pin refuses
                model.setHoverState({
                  overCigarItem: false,
                  featureIdUnderMouse: undefined,
                  mouseoverExtraInformation: formatSashimiTooltip(arc),
                  highlightedChainReadIds: model.sashimiSupportingReadIds(
                    groupKey,
                    arc,
                  ),
                })
              }}
              onMouseLeave={() => {
                setHoveredArcKey(null)
                model.clearHoverUnlessPinned()
              }}
              onClick={e => {
                if (e.currentTarget.closest(PAN_MOVED)) {
                  return
                }
                openSashimiWidget(model, arc, groupKey)
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

// Each section contributes an `up` sub-band over the coverage histogram and a
// `down` one in the strip below it.
const SashimiArcsOverlay = observer(function SashimiArcsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const palette = usePalette()
  const { scrollModel: scroll, sashimiArcSections: sections } = model
  if (sections.length === 0) {
    return null
  }
  // after the gate: `view.width` throws before the view is measured, and the
  // sections are empty until then
  const { width } = model.view
  return sections.flatMap(section =>
    SASHIMI_SIDES.map(side => {
      const arcs = section[side]
      const band = sashimiSideBand(section, side, model.bandHeights)
      const screenTop = bandScreenTop(band.top, scroll)
      // A grouped display re-renders on every scroll frame, so an off-screen
      // lane's paths would be reconciled for a band nobody can see.
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
