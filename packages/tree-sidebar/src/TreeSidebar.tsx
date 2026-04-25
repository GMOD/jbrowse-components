import { useCallback, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { Menu, MenuItem, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import { getLeafNames } from './clusterUtils.ts'

import type { TreeSidebarModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface MenuAnchor {
  x: number
  y: number
  names: string[]
}

const TreeSidebar = observer(function TreeSidebar({
  model,
}: {
  model: TreeSidebarModel
}) {
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null)

  const {
    hierarchy,
    treeAreaWidth,
    height,
    lineZoneHeight = 0,
    scrollTop = 0,
    showTree,
    sources,
    spatialIndex,
  } = model

  const treeCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setTreeCanvasRef(ref)
    },
    [model, treeAreaWidth, height, lineZoneHeight],
  )

  const mouseoverCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMouseoverCanvasRef(ref)
    },
    [model, viewWidth, height, lineZoneHeight],
  )

  function hitTestNode(event: React.MouseEvent) {
    if (spatialIndex) {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top + scrollTop
      const results = spatialIndex.index.search(x, y, x, y)
      return results.length > 0 ? spatialIndex.nodes[results[0]!] : undefined
    }
    return undefined
  }

  function handleMouseMove(event: React.MouseEvent) {
    const node = hitTestNode(event)
    model.setHoveredTreeNode(
      node ? { node, descendantNames: getLeafNames(node) } : undefined,
    )
  }

  function handleClick(event: React.MouseEvent) {
    const node = hitTestNode(event)
    if (node) {
      setMenuAnchor({
        x: event.clientX,
        y: event.clientY,
        names: getLeafNames(node),
      })
    }
  }

  if (!hierarchy || !showTree || !sources?.length) {
    return null
  }

  const contentHeight = height - lineZoneHeight

  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          height: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: lineZoneHeight,
            left: 0,
            width: treeAreaWidth,
            height: contentHeight,
            background: alpha('#fff', 0.8),
          }}
        />
        <canvas
          ref={treeCanvasRef}
          width={treeAreaWidth * 2}
          height={contentHeight * 2}
          style={{
            width: treeAreaWidth,
            height: contentHeight,
            position: 'absolute',
            top: lineZoneHeight,
            left: 0,
            pointerEvents: 'none',
          }}
        />
        <canvas
          ref={mouseoverCanvasRef}
          width={viewWidth}
          height={contentHeight}
          style={{
            width: viewWidth,
            height: contentHeight,
            position: 'absolute',
            top: lineZoneHeight,
            left: 0,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            model.setHoveredTreeNode(undefined)
          }}
          onClick={handleClick}
          style={{
            position: 'absolute',
            top: lineZoneHeight,
            left: 0,
            width: treeAreaWidth,
            height: contentHeight,
            zIndex: 2,
            cursor: 'pointer',
          }}
        />
        <ResizeHandle
          onDrag={distance => {
            model.setTreeAreaWidth(Math.max(10, treeAreaWidth + distance))
            return undefined
          }}
          style={{
            position: 'absolute',
            top: lineZoneHeight,
            height: contentHeight,
            width: 4,
            zIndex: 101,
            left: treeAreaWidth,
          }}
          vertical
        />
      </div>
      <Menu
        open={!!menuAnchor}
        onClose={() => {
          setMenuAnchor(null)
        }}
        anchorReference="anchorPosition"
        anchorPosition={
          menuAnchor ? { top: menuAnchor.y, left: menuAnchor.x } : undefined
        }
      >
        {model.subtreeFilter?.length ? (
          <MenuItem
            onClick={() => {
              model.setSubtreeFilter(undefined)
              setMenuAnchor(null)
            }}
          >
            Clear subtree filter
          </MenuItem>
        ) : null}
        {menuAnchor ? (
          <MenuItem
            onClick={() => {
              model.setSubtreeFilter(menuAnchor.names)
              setMenuAnchor(null)
            }}
          >
            Show only subtree ({menuAnchor.names.length} samples)
          </MenuItem>
        ) : null}
      </Menu>
    </>
  )
})

export default TreeSidebar
