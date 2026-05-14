import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../../stateModel'
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
  const mouseoverRef = useRef<HTMLCanvasElement>(null)
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

  useEffect(() => {
    const ctx = mouseoverRef.current?.getContext('2d')
    return ctx
      ? autorun(() => {
          if (isAlive(model)) {
            const {
              totalHeight,
              leafMap,
              rowHeight,
              highlightedRowNames,
              hoveredTreeNode,
            } = model
            const { width: viewWidth } = getContainingView(
              model,
            ) as LinearGenomeViewModel

            ctx.resetTransform()
            ctx.clearRect(0, 0, viewWidth, totalHeight)

            if (highlightedRowNames) {
              ctx.fillStyle = 'rgba(255,165,0,0.2)'
              const halfRowHeight = rowHeight / 2
              for (const name of highlightedRowNames) {
                const leaf = leafMap.get(name)
                if (leaf) {
                  ctx.fillRect(0, leaf.x! - halfRowHeight, viewWidth, rowHeight)
                }
              }

              // Draw orange dot at hovered tree node
              if (hoveredTreeNode) {
                ctx.fillStyle = 'rgba(255,165,0,0.8)'
                ctx.beginPath()
                ctx.arc(hoveredTreeNode.y, hoveredTreeNode.x, 4, 0, 2 * Math.PI)
                ctx.fill()
                ctx.strokeStyle = 'rgba(255,140,0,1)'
                ctx.lineWidth = 1
                ctx.stroke()
              }
            }
          }
        })
      : undefined
  }, [model])

  if (exportSVG) {
    return <>{children}</>
  } else {
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
          }}
        >
          {children}
        </svg>
        <canvas
          ref={mouseoverRef}
          width={width}
          height={totalHeight}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height: totalHeight,
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        />
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
  }
})

export default SvgWrapper
