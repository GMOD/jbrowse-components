import { useId, useRef, useState } from 'react'

import {
  ScrollEdgeShadow,
  VerticalScrollbar,
  useMouseState,
} from '@jbrowse/core/ui'
import { eventPoint } from '@jbrowse/core/util/eventPoint'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { openContextMenuFromEvent } from '@jbrowse/display-kit/DisplayContextMenu'
import {
  DisplayContextMenu,
  DisplayCrosshairs,
  RowLabelsOverlay,
  TreeSidebar,
  treeSidebarOffset,
  treeSidebarRightEdge,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { MafRendererFactory } from '../../LinearMafRenderer/MafRendererFactory.ts'
import { openInsertionWidgetOnClick } from '../openInsertionWidget.ts'
import AnnotationOverlay from './AnnotationOverlay.tsx'
import CodonTranslationOverlay from './CodonTranslationOverlay.tsx'
import DeletionsOverlay from './DeletionsOverlay.tsx'
import DragSelectionRect from './DragSelectionRect.tsx'
import EmptyLinesOverlay from './EmptyLinesOverlay.tsx'
import InsertionsOverlay from './InsertionsOverlay.tsx'
import InversionsOverlay from './InversionsOverlay.tsx'
import MAFTooltip from './MAFTooltip.tsx'
import MafBandLabels from './MafBandLabels.tsx'
import MafConservationBand from './MafConservationBand.tsx'
import MafCoverageBand from './MafCoverageBand.tsx'
import MafLegends from './MafLegends.tsx'
import MafRowsCanvas from './MafRowsCanvas.tsx'
import MsaHighlightOverlay from './MsaHighlightOverlay.tsx'
import SubsequenceContextMenu from './SubsequenceContextMenu.tsx'
import SummaryBarsOverlay from './SummaryBarsOverlay.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { mafPointerAt, resolveMafPointerHit } from './mafHitTest.ts'
import { useDragSelection } from './useDragSelection.ts'
import { useMafVirtualScroll } from './useMafVirtualScroll.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type React from 'react'

// Thin outer: owns the DisplayChrome + the drag-selection hook, which needs a
// ref to the chrome container (so it can't live in the body). The drag object
// flows to the body as a single prop.
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
  // the bands, the sidebar (which owns its own node menu) and the inter-region
  // gutter resolve to nothing, so the browser's menu falls through there
  function onContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    const { x, y } = eventPoint(e)
    const { pos, baseBp, inBands } = mafPointerAt(model, x, y)
    openContextMenuFromEvent(
      model,
      e,
      x >= treeSidebarRightEdge(model) && !pos.oob && !inBands
        ? {
            clientX: e.clientX,
            clientY: e.clientY,
            refName: pos.refName,
            pos: baseBp,
          }
        : undefined,
    )
  }
  return (
    <DisplayChrome
      model={model}
      factory={MafRendererFactory}
      testid="maf-display"
      ref={ref}
      style={{ height: model.height }}
      onMouseDown={drag.handleMouseDown}
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
  const {
    height,
    rowsHeight,
    rowsContentHeight,
    rowsTopOffset,
    scrollTop,
    effectiveRowHeight,
    sources,
    colorPalette,
  } = model
  const canvasId = useId()
  // The rows container, not the canvas: it is the same rectangle but also
  // covers the tree sidebar, so a wheel over the species names scrolls the rows
  // it labels rather than falling through to the view.
  const [rowsEl, setRowsEl] = useState<HTMLDivElement | null>(null)
  useMafVirtualScroll(rowsEl, model)
  const [coverageResizeActive, setCoverageResizeActive] = useState(false)
  const [conservationResizeActive, setConservationResizeActive] =
    useState(false)
  const resizeActive = coverageResizeActive || conservationResizeActive
  const view = model.view
  // the canvas box, not the viewport: must equal renderState.canvasWidth, and
  // every overlay below is positioned in the same space — see canvasWidthPx
  const width = model.canvasWidthPx

  const { isDragging, selectionRect, contextCoord, setContextCoord } = drag
  // Read here rather than in the component above, which is the one that renders
  // `DisplayChrome`: this display used to hold the position in `useDragSelection`'s
  // state, so every hover re-rendered the whole chrome. Read in the body it
  // re-renders the body, whose children are all observers taking stable model
  // getters and so memo-skip (ADR-028 measured exactly this).
  //
  // Measured against the chrome container, which is the same element
  // `useDragSelection`'s own `relativeXY` measures against — maf passes that
  // container as its `ref` — so `x`/`y` here and the drag rect's corners are in
  // one coordinate space, as they were when both came off the same state.
  const mouse = useMouseState(mouseTracker)

  const sidebarOffset = treeSidebarOffset(model)
  // Mouse guides/tooltips hide left of the sidebar's resize-handle edge.
  const dataLeft = treeSidebarRightEdge(model)

  // One projection + hit-test per mousemove, shared by the cursor style below
  // and by the tooltip, which used to resolve the same hover from the same
  // coordinates a second time. Row resolution is off mid-drag so the tooltip
  // keeps showing the selection's range readout. The cursor and its hit are one
  // object so the crosshairs and the tooltip can't be handed one without the
  // other.
  const pointer =
    mouse && mouse.x > dataLeft
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

  // Pointer cursor when an insertion marker is clickable under the cursor.
  // Matches the click gate in openInsertionWidgetOnClick: bases mode only.
  const overInsertion =
    model.basesRenderingActive && pointer?.hit.hover?.kind === 'insertion'

  return (
    <>
      {/* The rendering backend's canvas, spanning the band stack AND the rows:
          the coverage band is drawn into its top by the same backend that draws
          the rows, scissored to its own strip. It sits outside the rows
          container — which is offset to `rowsTopOffset` and owns the wheel
          listener — because it is no longer the rows' canvas alone. */}
      <canvas
        id={canvasId}
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height: rowsTopOffset + rowsHeight,
        }}
      />
      <MafCoverageBand
        model={model}
        onResizeActiveChange={setCoverageResizeActive}
      />
      <MafConservationBand
        model={model}
        onResizeActiveChange={setConservationResizeActive}
      />
      <MafBandLabels model={model} />
      <div
        ref={setRowsEl}
        data-testid="maf-rows"
        style={{
          position: 'absolute',
          top: rowsTopOffset,
          left: 0,
          width,
          height: rowsHeight,
          cursor: overInsertion ? 'pointer' : undefined,
        }}
      >
        <MafRowsCanvas model={model} />
        <MafLegends model={model} />
        <EmptyLinesOverlay
          segments={model.visibleEmptyLines}
          width={width}
          height={rowsHeight}
          palette={colorPalette}
        />
        <SummaryBarsOverlay
          bars={model.visibleSummaryBars}
          width={width}
          height={rowsHeight}
          palette={colorPalette}
        />
        <AnnotationOverlay
          markers={model.visibleFrames}
          width={width}
          height={rowsHeight}
        />
        {model.basesRenderingActive ? (
          <InsertionsOverlay
            markers={model.visibleInsertions}
            width={width}
            height={rowsHeight}
            palette={colorPalette}
            pxPerBp={1 / view.bpPerPx}
          />
        ) : null}
        <DeletionsOverlay
          markers={model.visibleDeletions}
          width={width}
          height={rowsHeight}
          palette={colorPalette}
        />
        <VisibleLabelsOverlay
          labels={model.visibleLabels}
          width={width}
          height={rowsHeight}
          mismatchRendering={model.mismatchRendering}
        />
        <CodonTranslationOverlay
          markers={model.visibleCodons}
          width={width}
          height={rowsHeight}
        />
        <InversionsOverlay
          markers={model.visibleInversions}
          width={width}
          height={rowsHeight}
        />
        {/* Both halves are portaled above the LGV's inter-region masks and so
            land on the display's origin, not this container's — hence the
            explicit `top`, which is the band stack above the rows.

            Not a `rowsTopOffset` getter on the model, which is the same idea
            and would look tidier: the sidebar's *inline* half stays in this
            container, which already carries the offset, so the model spelling
            would apply it twice. It stays here because maf's wheel listener is
            bound to this element by DOM node — that is what makes a wheel over
            the species names scroll the rows it labels. See the tree-sidebar
            package CLAUDE.md. */}
        <RowLabelsOverlay
          testId="maf-row-labels"
          sources={sources}
          rowHeight={effectiveRowHeight}
          labelOffset={sidebarOffset}
          width={width}
          height={rowsHeight}
          top={rowsTopOffset}
          scrollTop={scrollTop}
          showLabels={model.showRowLabels}
        />
        <TreeSidebar model={model} top={rowsTopOffset} />
      </div>
      {/* Offset below the stacked bands, which are pinned: only the rows
          scroll. Both render nothing while the rows fit. */}
      <ScrollEdgeShadow
        scrollTop={scrollTop}
        viewportHeight={rowsHeight}
        contentHeight={rowsContentHeight}
        top={rowsTopOffset}
      />
      <VerticalScrollbar
        scrollTop={scrollTop}
        setScrollTop={n => {
          model.setScrollTop(n)
        }}
        viewportHeight={rowsHeight}
        contentHeight={rowsContentHeight}
        controlsId={canvasId}
        top={rowsTopOffset}
      />
      <MsaHighlightOverlay model={model} view={view} height={height} />
      {pointer && !contextCoord && !resizeActive ? (
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
      <DisplayContextMenu model={model} />
    </>
  )
})

export default LinearMafDisplay
