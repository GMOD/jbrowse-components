import React, { useEffect, useMemo, useRef } from 'react'

import {
  getContainingView,
  getSession,
  useGpuBackend,
} from '@jbrowse/core/util'
import {
  DisplayErrorBar,
  DisplayLoadingOverlay,
} from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, TreeSidebar } from '@jbrowse/tree-sidebar'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Crosshairs from './Crosshairs.tsx'
import DragSelectionRect from './DragSelectionRect.tsx'
import MAFTooltip from './MAFTooltip.tsx'
import MafCoverageCanvas from './MafCoverageCanvas.tsx'
import MafCoverageResizeHandle from './MafCoverageResizeHandle.tsx'
import MafCoverageYScale from './MafCoverageYScale.tsx'
import MsaHighlightOverlay from './MsaHighlightOverlay.tsx'
import SubsequenceContextMenu from './SubsequenceContextMenu.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { useDragSelection } from './useDragSelection.ts'
import { MafRendererFactory } from '../../LinearMafRenderer/MafRendererFactory.ts'
import { getMafColorPalette } from '../../LinearMafRenderer/util.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LinearMafDisplay = observer(function (props: {
  model: LinearMafDisplayModel
}) {
  const { model } = props
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
  const ref = useRef<HTMLDivElement>(null)
  const theme = useTheme()
  const session = getSession(model)

  const { canvasRef } = useGpuBackend(MafRendererFactory, model)

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
    contextCoord,
    setContextCoord,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    clearSelectionBox,
  } = useDragSelection(ref)

  const view = getContainingView(model) as LinearGenomeViewModel
  const { width } = view

  const treeShowing = showTree && !!hierarchy
  const sidebarOffset = treeShowing ? treeAreaWidth : 0

  return (
    <div
      data-testid={`display-${model.configuration.displayId}${model.canvasDrawn ? '-done' : ''}`}
      ref={ref}
      style={{ position: 'relative', height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={() => {
        if (showSelectionBox) {
          clearSelectionBox()
        }
      }}
      onMouseLeave={handleMouseLeave}
    >
      <MafCoverageCanvas model={model} />
      <MafCoverageYScale model={model} />
      <MafCoverageResizeHandle model={model} />
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
      <DisplayErrorBar model={model} />
      <DisplayLoadingOverlay model={model} />
      {mouseY !== undefined &&
      mouseX !== undefined &&
      mouseX > sidebarOffset &&
      samples &&
      !contextCoord ? (
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
    </div>
  )
})

export default LinearMafDisplay
