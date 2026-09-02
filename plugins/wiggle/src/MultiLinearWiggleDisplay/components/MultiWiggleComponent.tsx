import { useCallback } from 'react'

import { useMouseState } from '@jbrowse/core/ui'
import { eventPoint } from '@jbrowse/core/util/eventPoint'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { openContextMenuFromEvent } from '@jbrowse/display-kit/DisplayContextMenu'
import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import {
  DisplayContextMenu,
  DisplayCrosshairs,
  TreeSidebar,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { ONSCREEN_AXIS_LEFT_PX } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import WiggleTooltip from '../../shared/WiggleTooltip.tsx'
import { wiggleMouseHandlers } from '../../shared/wiggleMouseHandlers.ts'
import MultiWiggleOverlayLines from '../MultiWiggleOverlayLines.tsx'
import MultiWiggleSvgScales, {
  scoreLegendReservedPx,
} from '../MultiWiggleSvgScales.tsx'
import MultiWiggleHint from './MultiWiggleHint.tsx'
import { findMultiWiggleContextHit, findMultiWiggleHit } from './findHit.ts'

import type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type React from 'react'

export type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'

// FloatingLegend's own default inset from the display's top-right corner, which
// the score legend's reserved band is added to rather than replacing.
const LEGEND_TOP_PX = 10

const MultiWiggleComponent = observer(function MultiWiggleComponent({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startRenderingBackend / stopRenderingBackend / renderNow on
  // the MultiLinearWiggleDisplay model. Sources changes are picked up because
  // installUpload's encode step reads `self.gpuProps()`, so a
  // gpuProps change re-fires every per-region autorun and re-uploads.
  const totalWidth = model.canvasWidthPx
  const height = model.height

  const computeHit = useCallback(
    (offsetX: number, offsetY: number) =>
      findMultiWiggleHit(model, model.host.visibleRegions, offsetX, offsetY),
    [model],
  )

  const { onPointerPosition, onClick } = wiggleMouseHandlers(model, computeHit)

  // Resolved from the click, like `onClick` above, rather than from the hover a
  // previous frame recorded — the viewport moves under a stationary cursor. An
  // overlay rendering with no row order written has no items, which is the
  // case `openContextMenuFromEvent`'s empty-menu close exists for.
  function onContextMenu(event: React.MouseEvent) {
    const hit = findMultiWiggleContextHit(
      model,
      model.host.visibleRegions,
      eventPoint(event).x,
    )
    openContextMenuFromEvent(
      model,
      event,
      hit
        ? { clientX: event.clientX, clientY: event.clientY, ...hit }
        : undefined,
    )
  }

  return (
    <DisplayChrome
      model={model}
      factory={WiggleRenderer}
      testid="multi-wiggle-display"
      style={{
        width: totalWidth,
        height,
        // inherited from `DisplayContainer` until it was deleted; kept verbatim
        // so the row labels and legend lay out the same
        whiteSpace: 'nowrap',
        textAlign: 'left',
      }}
      onPointerPosition={onPointerPosition}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {({ canvasRef, mouseTracker }) => (
        <MultiWiggleBody
          model={model}
          canvasRef={canvasRef}
          totalWidth={totalWidth}
          height={height}
          mouseTracker={mouseTracker}
        />
      )}
    </DisplayChrome>
  )
})

const MultiWiggleBody = observer(function MultiWiggleBody({
  model,
  canvasRef,
  totalWidth,
  height,
  mouseTracker,
}: {
  model: MultiWiggleDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  totalWidth: number
  height: number
  mouseTracker: MouseTracker
}) {
  const mouseState = useMouseState(mouseTracker)
  const { yTop, plotHeight } = model.plotGeometry
  const labelOffset = treeSidebarOffset(model)

  // Pin the right-aligned legends to the content's right edge, not the full
  // track width — the view's clamped scalar, not a derivation off
  // `visibleRegions`, which rebuilds its array every gesture frame.
  const legendWidth = model.host.contentRightEdgePx

  return (
    <>
      <div>
        <canvas
          ref={canvasRef}
          style={{
            width: totalWidth,
            // the box `model.ticks` stacks its per-row axes in
            height: plotHeight,
            position: 'absolute',
            left: 0,
            top: yTop,
          }}
        />
      </div>

      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          height,
          width: totalWidth,
        }}
      >
        <MultiWiggleSvgScales
          model={model}
          legendRight={legendWidth}
          // past the dendrogram, which paints an opaque panel over the left of
          // the plot and would otherwise swallow the axis
          scalebarLeft={labelOffset + ONSCREEN_AXIS_LEFT_PX}
          labelOffset={labelOffset}
        />

        <MultiWiggleOverlayLines model={model} width={totalWidth} />
      </svg>

      <TreeSidebar model={model} />

      {/* inline hint when the plot would otherwise be a silent blank */}
      <MultiWiggleHint model={model} />

      {/* The shared color key every display publishes, portaled above the
          inter-region masks by FloatingLegend itself. Pushed down past the
          score legend, which is pinned to the same right edge and drawn from
          y=0 inside the <svg> above (see scoreLegendReservedPx). */}
      {model.hasOverlayLegend ? (
        <FloatingLegend
          items={model.legendItems}
          top={LEGEND_TOP_PX + scoreLegendReservedPx(model)}
          onDismiss={() => {
            model.setShowLegend(false)
          }}
          onItemClick={item => {
            model.focusLegendGroup(item.label)
          }}
        />
      ) : null}

      {/* the full crosshair, not just a genomic guide: cursor y picks the row
          being read in multi-row mode and a score level in overlay mode, and
          both are hard to eyeball across a tall stack of plots.

          Drawn for the pointer, not for a hit, the way the multi-row feature
          and variant displays draw theirs: the row guide's whole job is to say
          which row the cursor is on, and a row with no bin at that base is
          exactly where it is needed. `DisplayCrosshairs` drops the genomic
          guide over the sidebar itself. */}
      {mouseState ? (
        <DisplayCrosshairs
          model={model}
          mouseX={mouseState.x}
          mouseY={mouseState.y}
        />
      ) : null}
      <WiggleTooltip model={model} mouseState={mouseState} />
      <DisplayContextMenu model={model} />
    </>
  )
})

export default MultiWiggleComponent
