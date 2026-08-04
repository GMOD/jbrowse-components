import { useId, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { VerticalScrollbar } from '@jbrowse/core/ui'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import {
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
import { resolveMafPointerHit } from './mafHitTest.ts'
import { useDragSelection } from './useDragSelection.ts'
import { useMafVirtualScroll } from './useMafVirtualScroll.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

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
  return (
    <DisplayChrome
      model={model}
      factory={MafRendererFactory}
      testid={`display-${getConf(model, 'displayId')}`}
      ref={ref}
      style={{ height: model.height }}
      onMouseDown={drag.handleMouseDown}
      onMouseMove={drag.handleMouseMove}
      onMouseUp={drag.handleMouseUp}
      onDoubleClick={() => {
        if (drag.showSelectionBox) {
          drag.clearSelectionBox()
        }
      }}
      onMouseLeave={drag.handleMouseLeave}
    >
      {({ canvasRef }) => (
        <MafBody model={model} canvasRef={canvasRef} drag={drag} />
      )}
    </DisplayChrome>
  )
})

const MafBody = observer(function MafBody({
  model,
  canvasRef,
  drag,
}: {
  model: LinearMafDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  drag: ReturnType<typeof useDragSelection>
}) {
  const {
    height,
    rowsHeight,
    rowsContentHeight,
    rowsTopOffset,
    scrollTop,
    effectiveRowHeight,
    showTree,
    sources,
    samples,
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
  const view = model.lgv
  const { width } = view

  const { isDragging, selectionRect, mouse, contextCoord, setContextCoord } =
    drag

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
        style={{
          position: 'absolute',
          top: rowsTopOffset,
          left: 0,
          width,
          height: rowsHeight,
          cursor: overInsertion ? 'pointer' : undefined,
        }}
      >
        <canvas
          id={canvasId}
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height: rowsHeight,
          }}
        />
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
        {showTree ? (
          <RowLabelsOverlay
            sources={sources}
            rowHeight={effectiveRowHeight}
            labelOffset={sidebarOffset}
            width={width}
            height={rowsHeight}
            scrollTop={scrollTop}
          />
        ) : null}
        <TreeSidebar model={model} />
      </div>
      {/* Offset below the stacked bands, which are pinned: only the rows
          scroll. Renders nothing while the rows fit. */}
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
      {pointer && samples && !contextCoord && !resizeActive ? (
        <div style={{ position: 'relative' }}>
          <DisplayCrosshairs
            model={model}
            mouseX={pointer.mouse.x}
            mouseY={pointer.mouse.y}
          />
          <MAFTooltip
            model={model}
            hit={pointer.hit}
            mouseY={pointer.mouse.y}
            clientX={pointer.mouse.clientX}
            clientY={pointer.mouse.clientY}
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
