import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import { laneHeaderRows } from '../laneHeader.ts'
import { SvgLaneHeaders } from './SvgLaneHeaders.tsx'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'

/**
 * The hovered group outlined in every lane that places it. A ribbon joins
 * ADJACENT lanes only, so a group the middle lane does not place would light
 * up nothing at all without this, and the glyph the reader is looking at
 * never moved.
 */
const GroupHighlight = observer(function GroupHighlight({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const palette = usePalette()
  const { glyphHeight } = model.laneStack
  return (
    <g transform={`translate(${model.dragOffsetPx} ${-model.scrollTop})`}>
      {model.hoveredGroupOutlines.map(({ lane, span }) => (
        <rect
          key={`hover-${lane.assemblyName}-${span[0]}-${span[1]}`}
          data-testid="multiway-hover-outline"
          x={Math.min(span[0], span[1]) - 1}
          y={lane.glyphTop - 1}
          width={Math.max(2, Math.abs(span[1] - span[0]) + 2)}
          height={glyphHeight + 2}
          fill="none"
          stroke={palette.text.primary}
        />
      ))}
    </g>
  )
})

/**
 * The vector layer over the canvas.
 *
 * On screen this is the hover outline alone, which follows the stack's scroll
 * — the headers are HTML (`LaneHeaders`), mounted beside this by the display's
 * body, because they are controls and SVG gave them neither layout nor a
 * focusable affordance. The export takes the outline plus `SvgLaneHeaders`,
 * the caption half of the same rows: no menu glyph, no cursors, no testids.
 */
const MultiWayOverlay = observer(function MultiWayOverlay({
  model,
  exportSVG,
}: {
  model: MultiWaySyntenyDisplayModel
  exportSVG?: boolean
}) {
  const palette = usePalette()
  const view = model.lgv
  if (!exportSVG) {
    return (
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: model.canvasWidth,
          height: model.height,
          pointerEvents: 'none',
        }}
      >
        <GroupHighlight model={model} />
      </svg>
    )
  }
  return (
    <>
      <GroupHighlight model={model} />
      <g transform={`translate(0 ${-model.scrollTop})`}>
        <SvgLaneHeaders
          rows={laneHeaderRows(
            model.laneStack.lanes,
            model.visibleBpSpan,
            view.coarseVisibleLocStrings || view.visibleLocStrings,
          )}
          width={model.canvasWidth}
          palette={palette}
        />
      </g>
    </>
  )
})

export default MultiWayOverlay
