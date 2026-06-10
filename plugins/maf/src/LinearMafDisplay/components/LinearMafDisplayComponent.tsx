import { useEffect, useMemo, useRef, useState } from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, TreeSidebar } from '@jbrowse/tree-sidebar'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Crosshairs from './Crosshairs.tsx'
import DeletionsOverlay from './DeletionsOverlay.tsx'
import DragSelectionRect from './DragSelectionRect.tsx'
import EmptyLinesOverlay from './EmptyLinesOverlay.tsx'
import InsertionsOverlay from './InsertionsOverlay.tsx'
import MAFTooltip from './MAFTooltip.tsx'
import MafCoverageCanvas from './MafCoverageCanvas.tsx'
import MafCoverageResizeHandle from './MafCoverageResizeHandle.tsx'
import MafCoverageYScale from './MafCoverageYScale.tsx'
import MsaHighlightOverlay from './MsaHighlightOverlay.tsx'
import SubsequenceContextMenu from './SubsequenceContextMenu.tsx'
import SummaryBarsOverlay from './SummaryBarsOverlay.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { useDragSelection } from './useDragSelection.ts'
import { MafRendererFactory } from '../../LinearMafRenderer/MafRendererFactory.ts'
import { getMafColorPalette } from '../../LinearMafRenderer/util.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Thin outer: owns the DisplayChrome + the drag-selection hook, which needs a
// ref to the chrome container (so it can't live in the body). The drag object
// flows to the body as a single prop.
const LinearMafDisplay = observer(function LinearMafDisplay(props: {
  model: LinearMafDisplayModel
}) {
  const { model } = props
  const ref = useRef<HTMLDivElement>(null)
  const drag = useDragSelection(ref)
  return (
    <DisplayChrome
      model={model}
      factory={MafRendererFactory}
      testid={`display-${model.configuration.displayId}`}
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
    coverageDisplayHeight,
    scrollTop,
    rowHeight,
    showTree,
    treeAreaWidth,
    hierarchy,
    sources,
    samples,
  } = model
  const theme = useTheme()
  const [resizeActive, setResizeActive] = useState(false)
  const session = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { width } = view

  // Push theme-derived color palette into the model. Drives `gpuProps()`,
  // so theme changes re-encode on the main thread (no RPC refetch). The
  // palette also flows through `renderState` to the Canvas2D path so MAF
  // colors stay in lockstep with the user's theme.
  const palette = useMemo(() => getMafColorPalette(theme), [theme])
  useEffect(() => {
    model.setColorPalette(palette)
  }, [model, palette])

  const {
    isDragging,
    dragStartX,
    dragEndX,
    dragStartY,
    dragEndY,
    showSelectionBox,
    mouseX,
    mouseY,
    mouseClientX,
    mouseClientY,
    contextCoord,
    setContextCoord,
  } = drag

  const treeShowing = showTree && !!hierarchy
  const sidebarOffset = treeShowing ? treeAreaWidth : 0

  return (
    <>
      <MafCoverageCanvas model={model} />
      <MafCoverageYScale model={model} />
      <MafCoverageResizeHandle model={model} onActiveChange={setResizeActive} />
      <div
        style={{
          position: 'absolute',
          top: coverageDisplayHeight,
          left: 0,
          width,
          height: rowsHeight,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height: rowsHeight,
          }}
        />
        <EmptyLinesOverlay
          segments={model.visibleEmptyLines}
          width={width}
          height={rowsHeight}
          palette={palette}
        />
        <SummaryBarsOverlay
          bars={model.visibleSummaryBars}
          width={width}
          height={rowsHeight}
          palette={palette}
        />
        <InsertionsOverlay
          markers={model.visibleInsertions}
          width={width}
          height={rowsHeight}
          palette={palette}
          pxPerBp={1 / view.bpPerPx}
        />
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
        {showTree && sources?.length ? (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width,
              height: rowsHeight,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <SvgRowLabels
              sources={sources}
              rowHeight={rowHeight}
              labelOffset={sidebarOffset}
              scrollTop={scrollTop}
              availableHeight={rowsHeight}
            />
          </svg>
        ) : null}
        <TreeSidebar model={model} />
      </div>
      <MsaHighlightOverlay model={model} view={view} height={height} />
      {mouseY !== undefined &&
      mouseX !== undefined &&
      mouseX > sidebarOffset &&
      samples &&
      !contextCoord &&
      !resizeActive ? (
        <div style={{ position: 'relative' }}>
          <Crosshairs
            width={width}
            height={height}
            scrollTop={scrollTop}
            mouseX={mouseX}
            mouseY={mouseY}
          />
          <MAFTooltip
            model={model}
            mouseX={mouseX}
            mouseY={mouseY}
            clientX={mouseClientX}
            clientY={mouseClientY}
            origMouseX={isDragging ? dragStartX : undefined}
          />
        </div>
      ) : null}
      {(isDragging || showSelectionBox) &&
      dragStartX !== undefined &&
      dragEndX !== undefined &&
      dragStartY !== undefined &&
      dragEndY !== undefined ? (
        <DragSelectionRect
          dragStartX={dragStartX}
          dragEndX={dragEndX}
          dragStartY={dragStartY}
          dragEndY={dragEndY}
          scrollTop={scrollTop}
        />
      ) : null}
      <SubsequenceContextMenu
        session={session}
        model={model}
        view={view}
        samples={samples}
        rowHeight={rowHeight}
        rowsTopOffset={coverageDisplayHeight}
        scrollTop={scrollTop}
        contextCoord={contextCoord}
        setContextCoord={setContextCoord}
      />
    </>
  )
})

export default LinearMafDisplay
