import React, { useRef } from 'react'

import { Menu } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
  useGpuModelLifecycle,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Crosshairs from './Crosshairs.tsx'
import MAFTooltip from './MAFTooltip.tsx'
import MsaHighlightOverlay from './MsaHighlightOverlay.tsx'
import YScaleBars from './Sidebar/YScaleBars.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { useDragSelection } from './useDragSelection.ts'
import { MafRendererFactory } from '../../LinearMafRenderer/MafRendererFactory.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LinearMafDisplay = observer(function (props: {
  model: LinearMafDisplayModel
}) {
  const { model } = props
  const { height, scrollTop, rowHeight, sidebarWidth, samples: sources } = model
  const ref = useRef<HTMLDivElement>(null)
  const theme = useTheme()
  const session = getSession(model)

  const { canvasRef } = useGpuModelLifecycle(MafRendererFactory, model)

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
      {model.showSidebar ? <YScaleBars model={model} /> : null}
      <MsaHighlightOverlay model={model} view={view} height={height} />
      {!model.canvasDrawn ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)',
          }}
        >
          {model.statusMessage ?? 'Loading…'}
        </div>
      ) : null}
      {mouseY !== undefined &&
      mouseX !== undefined &&
      mouseX > sidebarWidth &&
      sources &&
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
            backgroundColor: 'rgba(0, 0, 255, 0.2)',
            border: '1px solid rgba(0, 0, 255, 0.5)',
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
              if (!contextCoord) {
                return
              }

              const { refName, assemblyName } = view.displayedRegions[0]!
              const [s, e] = [
                Math.min(contextCoord.dragStartX, contextCoord.dragEndX),
                Math.max(contextCoord.dragStartX, contextCoord.dragEndX),
              ]

              if (isSessionModelWithWidgets(session)) {
                const widget = session.addWidget(
                  'MafSequenceWidget',
                  'mafSequence',
                  {
                    adapterConfig: model.adapterConfig,
                    samples: model.samples,
                    regions: [
                      {
                        refName,
                        start: view.pxToBp(s).coord - 1,
                        end: view.pxToBp(e).coord,
                        assemblyName,
                      },
                    ],
                    connectedViewId: view.id,
                  },
                )
                session.showWidget(widget)
              }
              setContextCoord(undefined)
            },
          },
          {
            label: 'View subsequences (selected rows)',
            onClick: () => {
              if (!contextCoord || !sources) {
                return
              }

              const { refName, assemblyName } = view.displayedRegions[0]!
              const [s, e] = [
                Math.min(contextCoord.dragStartX, contextCoord.dragEndX),
                Math.max(contextCoord.dragStartX, contextCoord.dragEndX),
              ]

              const minY = Math.min(
                contextCoord.dragStartY,
                contextCoord.dragEndY,
              )
              const maxY = Math.max(
                contextCoord.dragStartY,
                contextCoord.dragEndY,
              )
              const startRowIdx = Math.floor((minY + scrollTop) / rowHeight)
              const endRowIdx = Math.ceil((maxY + scrollTop) / rowHeight)
              const selectedSamples = sources.slice(startRowIdx, endRowIdx)

              if (
                isSessionModelWithWidgets(session) &&
                selectedSamples.length > 0
              ) {
                const widget = session.addWidget(
                  'MafSequenceWidget',
                  'mafSequence',
                  {
                    adapterConfig: model.adapterConfig,
                    samples: selectedSamples,
                    regions: [
                      {
                        refName,
                        start: view.pxToBp(s).coord - 1,
                        end: view.pxToBp(e).coord,
                        assemblyName,
                      },
                    ],
                    connectedViewId: view.id,
                  },
                )
                session.showWidget(widget)
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
