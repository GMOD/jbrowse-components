import React, { useEffect, useRef, useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getContainingView, getEnv } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Crosshairs from './Crosshairs'
import SequenceDialog from './GetSequenceDialog/GetSequenceDialog'
import MAFTooltip from './MAFTooltip'
import YScaleBars from './Sidebar/YScaleBars'

import type { LinearMafDisplayModel } from '../stateModel'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LinearMafDisplay = observer(function (props: {
  model: LinearMafDisplayModel
}) {
  const { model } = props
  const { pluginManager } = getEnv(model)
  const { rowHeight, height, scrollTop, samples: sources } = model
  const ref = useRef<HTMLDivElement>(null)
  const theme = useTheme()

  const LinearGenomePlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as import('@jbrowse/plugin-linear-genome-view').default
  const { BaseLinearDisplayComponent } = LinearGenomePlugin.exports

  const [mouseY, setMouseY] = useState<number>()
  const [mouseX, setMouseX] = useState<number>()
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState<number>()
  const [dragEndX, setDragEndX] = useState<number>()
  const [showSelectionBox, setShowSelectionBox] = useState(false)
  const [contextCoord, setContextCoord] = useState<{
    coord: [number, number]
    dragStartX: number
    dragEndX: number
  }>()
  const [showSequenceDialog, setShowSequenceDialog] = useState(false)
  const [selectionCoords, setSelectionCoords] = useState<
    | {
        dragStartX: number
        dragEndX: number
      }
    | undefined
  >()
  const { width } = getContainingView(model) as LinearGenomeViewModel

  const handleMouseDown = (event: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    const left = rect?.left || 0
    const clientX = event.clientX - left

    // Clear the previous selection box when starting a new drag
    setShowSelectionBox(false)
    setIsDragging(true)
    setDragStartX(clientX)
    setDragEndX(clientX)
    event.stopPropagation()
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    const top = rect?.top || 0
    const left = rect?.left || 0
    const clientX = event.clientX - left
    const clientY = event.clientY - top

    setMouseY(clientY)
    setMouseX(clientX)

    if (isDragging) {
      setDragEndX(clientX)
    }
  }

  const handleMouseUp = (event: React.MouseEvent) => {
    if (isDragging && dragStartX !== undefined && dragEndX !== undefined) {
      // Calculate the drag distance
      const dragDistanceX = Math.abs(dragEndX - dragStartX)

      // Only show context menu if the drag distance is at least 2 pixels in either direction
      if (dragDistanceX >= 2) {
        setContextCoord({
          coord: [event.clientX, event.clientY],
          dragEndX: event.clientX,
          dragStartX: dragStartX,
        })

        // Set showSelectionBox to true to keep the selection visible
        setShowSelectionBox(true)
      } else {
        // For very small drags (less than 2px), don't show selection box or context menu
        clearSelectionBox()
      }
    }

    // Only set isDragging to false, but keep the coordinates
    setIsDragging(false)
  }

  // Function to clear the selection box
  const clearSelectionBox = () => {
    setShowSelectionBox(false)
    setDragStartX(undefined)
    setDragEndX(undefined)
  }

  // Add keydown event handler to clear selection box when Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showSelectionBox) {
        clearSelectionBox()
      }
    }

    // Add click handler to clear selection box when clicking outside of it
    const handleClickOutside = (event: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node) &&
        showSelectionBox
      ) {
        clearSelectionBox()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('click', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [showSelectionBox, clearSelectionBox])

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={() => {
        // Clear selection box on double click
        if (showSelectionBox) {
          clearSelectionBox()
        }
      }}
      onMouseLeave={() => {
        setMouseY(undefined)
        setMouseX(undefined)
        setIsDragging(false)
      }}
    >
      <BaseLinearDisplayComponent {...props} />
      <YScaleBars model={model} />
      {mouseY && mouseX && sources && !contextCoord && !showSequenceDialog ? (
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
            origMouseX={dragStartX}
            rowHeight={rowHeight}
            sources={sources}
          />
        </div>
      ) : null}
      {(isDragging || showSelectionBox) &&
      dragStartX !== undefined &&
      dragEndX !== undefined ? (
        <div
          style={{
            position: 'absolute',
            left: Math.min(dragStartX, dragEndX),
            top: 0,
            width: Math.abs(dragEndX - dragStartX),
            height,
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
            label: 'View subsequence',
            onClick: () => {
              if (!contextCoord) {
                return
              }

              // Store the selection coordinates for the SequenceDialog to use
              setSelectionCoords({
                dragStartX: contextCoord.dragStartX,
                dragEndX: contextCoord.dragEndX,
              })

              // Show the dialog
              setShowSequenceDialog(true)

              // Close the context menu
              setContextCoord(undefined)
            },
          },
        ]}
      />

      {showSequenceDialog ? (
        <SequenceDialog
          model={model}
          selectionCoords={selectionCoords}
          onClose={() => {
            setShowSequenceDialog(false)
            setSelectionCoords(undefined)
          }}
        />
      ) : null}
    </div>
  )
})

export default LinearMafDisplay
