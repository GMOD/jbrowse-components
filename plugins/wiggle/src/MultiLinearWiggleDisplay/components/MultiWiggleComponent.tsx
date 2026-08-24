import { useCallback } from 'react'

import { ContextMenu, useMouseState } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { eventPoint } from '@jbrowse/core/util/eventPoint'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import {
  DisplayCrosshairs,
  TreeSidebar,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { ONSCREEN_AXIS_LEFT_PX } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import WiggleTooltip from '../../shared/WiggleTooltip.tsx'
import { legendRightEdgePx } from '../../shared/wiggleComponentUtils.ts'
import { wiggleMouseHandlers } from '../../shared/wiggleMouseHandlers.ts'
import MultiWiggleOverlayLines from '../MultiWiggleOverlayLines.tsx'
import MultiWiggleSvgScales, {
  scoreLegendReservedPx,
} from '../MultiWiggleSvgScales.tsx'
import MultiWiggleHint from './MultiWiggleHint.tsx'
import { findMultiWiggleContextHit, findMultiWiggleHit } from './findHit.ts'

import type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

export type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'

type LGV = LinearGenomeViewModel

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
  // installPerRegionLifecycle's encode step reads `self.gpuProps()`, so a
  // gpuProps change re-fires every per-region autorun and re-uploads.
  const view = getContainingView(model) as LGV
  const totalWidth = model.canvasWidthPx
  const height = model.height

  const computeHit = useCallback(
    (offsetX: number, offsetY: number) =>
      findMultiWiggleHit(model, view.visibleRegions, offsetX, offsetY),
    [model, view],
  )

  const { onPointerPosition, onClick } = wiggleMouseHandlers(model, computeHit)

  // Resolved from the click, like `onClick` above, rather than from the hover a
  // previous frame recorded — the viewport moves under a stationary cursor.
  function onContextMenu(event: React.MouseEvent) {
    const hit = findMultiWiggleContextHit(
      model,
      view.visibleRegions,
      eventPoint(event).x,
    )
    if (!hit) {
      return
    }
    // Opened first, then asked what it holds: the items are built from the
    // position, so there is no answer before the position is set. An overlay
    // rendering with no row order written has neither item — closing again and
    // letting the browser menu through beats suppressing it to show nothing,
    // which on a canvas costs the reader "Save image as...". Same reason the
    // `hit` guard above exists for the inter-region gutter and the tree
    // sidebar, which overlays this container and owns its own node menu.
    model.openContextMenu({
      clientX: event.clientX,
      clientY: event.clientY,
      ...hit,
    })
    if (model.contextMenuItems().length === 0) {
      model.closeContextMenu()
    } else {
      event.preventDefault()
      // the tooltip and crosshair would otherwise sit behind the menu
      model.setHoveredFeature(undefined)
    }
  }

  return (
    <DisplayChrome
      model={model}
      factory={WiggleRenderer}
      testid="multi-wiggle-display"
      // The clustered frame's only other DOM evidence is the dendrogram canvas,
      // which `showTree: false` removes — so a figure that clusters with the
      // tree hidden had nothing to wait on but a guessed delay. Published here
      // instead, off the same model state the tree reads.
      data-clustered={model.hierarchy ? 'true' : 'false'}
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
  // read here rather than beside the handlers, so a mousemove re-renders this
  // body instead of the whole DisplayChrome above it
  const mouseState = useMouseState(mouseTracker)
  const { yTop, plotHeight } = model.plotGeometry
  const labelOffset = treeSidebarOffset(model)

  // Pin the right-aligned legends to the content's right edge, not the full
  // track width (see legendRightEdgePx).
  const view = getContainingView(model) as LGV
  const legendWidth = legendRightEdgePx(view.visibleRegions, totalWidth)

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
        />
      ) : null}

      {/* the full crosshair, not just a genomic guide: cursor y picks the row
          being read in multi-row mode and a score level in overlay mode, and
          both are hard to eyeball across a tall stack of plots */}
      {model.hoveredFeature && mouseState ? (
        <DisplayCrosshairs
          model={model}
          mouseX={mouseState.x}
          mouseY={mouseState.y}
        />
      ) : null}
      <WiggleTooltip model={model} mouseState={mouseState} />

      {/* here rather than beside the handler that opens it: reading
          `contextMenuInfo` in the outer component would attribute it to the
          chrome's observer, re-rendering the whole subtree on every open */}
      <ContextMenu
        anchor={model.contextMenuInfo}
        menuItems={() => model.contextMenuItems()}
        onClose={() => {
          model.closeContextMenu()
        }}
      />
    </>
  )
})

export default MultiWiggleComponent
