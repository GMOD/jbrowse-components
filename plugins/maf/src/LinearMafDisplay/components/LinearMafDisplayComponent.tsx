import React, { useEffect, useMemo, useRef } from 'react'

import { Menu } from '@jbrowse/core/ui'
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
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Crosshairs from './Crosshairs.tsx'
import MAFTooltip from './MAFTooltip.tsx'
import MsaHighlightOverlay from './MsaHighlightOverlay.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { useDragSelection } from './useDragSelection.ts'
import { MafRendererFactory } from '../../LinearMafRenderer/MafRendererFactory.ts'
import { getMafColorPalette } from '../../LinearMafRenderer/util.ts'
import { openSubsequenceWidget } from '../openSubsequenceWidget.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LinearMafDisplay = observer(function (props: {
  model: LinearMafDisplayModel
}) {
  const { model } = props
  const {
    height,
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
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
        }}
      />
      <VisibleLabelsOverlay
        labels={model.visibleLabels}
        width={width}
        height={height}
        mismatchRendering={model.mismatchRendering}
      />
      {showTree && sources?.length ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <SvgRowLabels
            sources={sources}
            rowHeight={rowHeight}
            labelOffset={sidebarOffset}
            scrollTop={scrollTop}
            availableHeight={height}
          />
        </svg>
      ) : null}
      <TreeSidebar model={model} />
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
            origMouseX={isDragging ? dragStartX : undefined}
          />
        </div>
      ) : null}
      {(isDragging || showSelectionBox) &&
      dragStartX !== undefined &&
      dragEndX !== undefined &&
      dragStartY !== undefined &&
      dragEndY !== undefined ? (
        <div
          style={{
            position: 'absolute',
            left: Math.min(dragStartX, dragEndX),
            top: Math.min(dragStartY, dragEndY) + scrollTop,
            width: Math.abs(dragEndX - dragStartX),
            height: Math.abs(dragEndY - dragStartY),
            backgroundColor: alpha(theme.palette.primary.main, 0.2),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <Menu
        open={Boolean(contextCoord)}
        onMenuItemClick={(_, callback) => {
          callback()
          setContextCoord(undefined)
        }}
        onClose={() => {
          setContextCoord(undefined)
        }}
        slotProps={{
          transition: {
            onExit: () => {
              setContextCoord(undefined)
            },
          },
        }}
        anchorReference="anchorPosition"
        anchorPosition={
          contextCoord
            ? { top: contextCoord.coord[1], left: contextCoord.coord[0] }
            : undefined
        }
        style={{
          zIndex: theme.zIndex.tooltip,
        }}
        menuItems={[
          {
            label: 'View subsequences (all rows)',
            onClick: () => {
              if (contextCoord && samples) {
                openSubsequenceWidget(
                  session,
                  model,
                  view,
                  contextCoord.startX,
                  contextCoord.endX,
                  samples,
                )
              }
              setContextCoord(undefined)
            },
          },
          {
            label: 'View subsequences (selected rows)',
            onClick: () => {
              if (contextCoord && samples) {
                const minY = Math.min(contextCoord.startY, contextCoord.endY)
                const maxY = Math.max(contextCoord.startY, contextCoord.endY)
                const startRow = Math.floor((minY + scrollTop) / rowHeight)
                const endRow = Math.ceil((maxY + scrollTop) / rowHeight)
                openSubsequenceWidget(
                  session,
                  model,
                  view,
                  contextCoord.startX,
                  contextCoord.endX,
                  samples.slice(startRow, endRow),
                )
              }
              setContextCoord(undefined)
            },
          },
        ]}
      />
    </div>
  )
})

export default LinearMafDisplay
