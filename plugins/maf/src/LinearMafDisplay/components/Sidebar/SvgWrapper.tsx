import React, { useCallback, useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import RowHighlights from './RowHighlights.tsx'

import type { LinearMafDisplayModel } from '../../stateModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const SvgWrapper = observer(function ({
  children,
  model,
  exportSVG,
}: {
  model: LinearMafDisplayModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  const theme = useTheme()
  const { treeMenuAnchor, subtreeFilter } = model
  const [isResizing, setIsResizing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      const startX = e.clientX
      const startWidth = model.treeAreaWidth

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX
        model.setTreeAreaWidth(Math.max(20, startWidth + delta))
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [model],
  )

  if (exportSVG) {
    return <>{children}</>
  }
  const { totalHeight, treeWidth, hierarchy } = model
  const { width } = getContainingView(model) as LinearGenomeViewModel
  return (
    <>
      <svg
        style={{
          position: 'absolute',
          userSelect: 'none',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          height: totalHeight,
          width,
          zIndex: 1000,
        }}
      >
        {children}
        <RowHighlights model={model} width={width} />
      </svg>
      {hierarchy ? (
        <div
          onMouseDown={handleResizeMouseDown}
          onMouseEnter={() => {
            setIsHovered(true)
          }}
          onMouseLeave={() => {
            setIsHovered(false)
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: treeWidth + 4,
            width: 6,
            height: totalHeight,
            cursor: 'col-resize',
            background: isResizing
              ? theme.palette.primary.main
              : isHovered
                ? theme.palette.action.selected
                : theme.palette.action.hover,
            zIndex: 10000,
          }}
        />
      ) : null}
      <Menu
        open={Boolean(treeMenuAnchor)}
        onMenuItemClick={(_, callback) => {
          callback()
        }}
        onClose={() => {
          model.setTreeMenuAnchor(undefined)
        }}
        anchorReference="anchorPosition"
        anchorPosition={
          treeMenuAnchor
            ? { top: treeMenuAnchor.y, left: treeMenuAnchor.x }
            : undefined
        }
        style={{ zIndex: theme.zIndex.tooltip }}
        menuItems={[
          ...(subtreeFilter
            ? [
                {
                  label: 'Undo show only subtree',
                  onClick: () => {
                    model.setSubtreeFilter(undefined)
                    model.setTreeMenuAnchor(undefined)
                  },
                },
              ]
            : []),
          ...(treeMenuAnchor
            ? [
                {
                  label: 'Show only subtree',
                  onClick: () => {
                    model.setSubtreeFilter(treeMenuAnchor.names)
                    model.setTreeMenuAnchor(undefined)
                  },
                },
              ]
            : []),
        ]}
      />
    </>
  )
})

export default SvgWrapper
