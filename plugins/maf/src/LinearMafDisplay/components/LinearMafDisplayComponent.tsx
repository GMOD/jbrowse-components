import { useRef } from 'react'

import { useMouseState } from '@jbrowse/core/ui'
import { eventPoint } from '@jbrowse/core/util/eventPoint'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { openContextMenuFromEvent } from '@jbrowse/display-kit/DisplayContextMenu'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import {
  DisplayCrosshairs,
  RowsPanel,
  treeSidebarRightEdge,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { MAF_MARKS } from '../../LinearMafRenderer/mafMarks.ts'
import { openInsertionWidgetOnClick } from '../openInsertionWidget.ts'
import DragSelectionRect from './DragSelectionRect.tsx'
import MAFTooltip from './MAFTooltip.tsx'
import MafBandHandles from './MafBandHandles.tsx'
import MafBandLabels from './MafBandLabels.tsx'
import MafRowOverlays from './MafRowOverlays.tsx'
import SubsequenceContextMenu from './SubsequenceContextMenu.tsx'
import { mafPointerAt, resolveMafPointerHit } from './mafHitTest.ts'
import { useDragSelection } from './useDragSelection.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type React from 'react'

function createMafBackend(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, MAF_MARKS)
}

function rowUnder(model: LinearMafDisplayModel, x: number, y: number) {
  const { pos, rowIndex, inBands } = mafPointerAt(model, x, y)
  const row =
    x >= treeSidebarRightEdge(model) && !inBands && !pos.oob
      ? model.sources[rowIndex]
      : undefined
  return row ? { name: row.name } : undefined
}

// Thin outer: owns the DisplayChrome and the drag-selection hook, which needs a
// ref to the chrome container.
const LinearMafDisplay = observer(function LinearMafDisplay(props: {
  model: LinearMafDisplayModel
}) {
  const { model } = props
  const ref = useRef<HTMLDivElement>(null)
  const drag = useDragSelection(ref, {
    dataLeft: treeSidebarRightEdge(model),
    onClick: (x, y) => {
      openInsertionWidgetOnClick(model, x, y)
    },
  })
  function onContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    const { x, y } = eventPoint(e)
    // The hit resolves here because `closeContextMenu` runs before an item's
    // onClick.
    const { pos, baseBp, inBands, hover } = resolveMafPointerHit({
      model,
      mouseX: x,
      mouseY: y,
      resolveRowHover: x >= treeSidebarRightEdge(model),
    })
    openContextMenuFromEvent(
      model,
      e,
      x >= treeSidebarRightEdge(model) && !pos.oob && !inBands
        ? {
            clientX: e.clientX,
            clientY: e.clientY,
            refName: pos.refName,
            pos: baseBp,
            hover,
          }
        : undefined,
    )
  }
  return (
    <DisplayChrome
      model={model}
      factory={createMafBackend}
      testid="maf-display"
      ref={ref}
      onPointerDown={drag.handlePointerDown}
      onMouseDown={drag.handleMouseDown}
      onPointerPosition={state => {
        model.setHoveredFeature(
          state ? rowUnder(model, state.x, state.y) : undefined,
        )
      }}
      onMouseMove={drag.handleMouseMove}
      onMouseUp={drag.handleMouseUp}
      onContextMenu={onContextMenu}
      onDoubleClick={() => {
        if (drag.showSelectionBox) {
          drag.clearSelectionBox()
        }
      }}
      onMouseLeave={drag.handleMouseLeave}
    >
      {({ canvasRef, mouseTracker }) => (
        <MafBody
          model={model}
          canvasRef={canvasRef}
          drag={drag}
          mouseTracker={mouseTracker}
        />
      )}
    </DisplayChrome>
  )
})

const MafBody = observer(function MafBody({
  model,
  canvasRef,
  drag,
  mouseTracker,
}: {
  model: LinearMafDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  drag: ReturnType<typeof useDragSelection>
  mouseTracker: MouseTracker
}) {
  const { rowsHeight, rowsTopOffset } = model
  // The canvas box, not the viewport: must equal renderState.canvasWidth (see
  // canvasWidthPx).
  const width = model.canvasWidthPx

  const { isDragging, selectionRect, contextCoord, setContextCoord } = drag
  // Read here, not in the outer component, so a hover re-renders the body only
  // (ADR-028). Measured against the chrome container, as `useDragSelection`'s
  // `relativeXY` is, so `x`/`y` and the drag rect share a coordinate space.
  const mouse = useMouseState(mouseTracker)

  const dataLeft = treeSidebarRightEdge(model)

  // One projection and hit test per mousemove, shared by the cursor style and
  // the tooltip. Row resolution is off mid-drag so the tooltip keeps the
  // selection's range readout.
  const pointer =
    mouse && mouse.x >= dataLeft
      ? {
          mouse,
          hit: resolveMafPointerHit({
            model,
            mouseX: mouse.x,
            mouseY: mouse.y,
            resolveRowHover: !isDragging,
          }),
        }
      : undefined

  const overInsertion = pointer?.hit.hover?.kind === 'insertion'

  return (
    <>
      {/* The rendering backend's canvas, spanning the band stack AND the rows:
          the coverage band is drawn into its top by the same backend that draws
          the rows, scissored to its own strip, so it sits outside the rows panel. */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height: rowsTopOffset + rowsHeight,
        }}
      />
      <MafBandHandles model={model} />
      <MafBandLabels model={model} />
      <RowsPanel
        model={model}
        testIdPrefix="maf"
        cursor={overInsertion ? 'pointer' : undefined}
      >
        <MafRowOverlays model={model} width={width} height={rowsHeight} />
      </RowsPanel>
      {pointer && !contextCoord ? (
        <div style={{ position: 'relative' }}>
          <DisplayCrosshairs
            model={model}
            mouseX={pointer.mouse.x}
            mouseY={pointer.mouse.y}
          />
          <MAFTooltip
            model={model}
            hit={pointer.hit}
            mouseState={pointer.mouse}
            origMouseX={isDragging ? selectionRect?.startX : undefined}
          />
        </div>
      ) : null}
      {selectionRect ? <DragSelectionRect rect={selectionRect} /> : null}
      <SubsequenceContextMenu
        model={model}
        contextCoord={contextCoord}
        setContextCoord={setContextCoord}
      />
    </>
  )
})

export default LinearMafDisplay
