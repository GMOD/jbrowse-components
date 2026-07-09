import { useCallback, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Menu, MenuItem, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import { getLeafNames } from './clusterUtils.ts'
import {
  TREE_RESIZE_HANDLE_WIDTH,
  treeContentHeight,
} from './treeSidebarGeometry.ts'

import type { TreeSidebarModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface MenuAnchor {
  x: number
  y: number
  names: string[]
}

// Centered line with a contrasting halo, hidden until the handle is hovered.
const useStyles = makeStyles()(theme => ({
  resizeHandle: {
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: '50%',
      width: 3,
      transform: 'translateX(-50%)',
      background: theme.palette.grey[500],
      opacity: 0,
      boxShadow: `0 0 0 1px ${alpha('#fff', 0.6)}`,
      transition: 'opacity 100ms',
    },
    '&:hover::after': {
      opacity: 1,
    },
  },
}))

const TreeSidebar = observer(function TreeSidebar({
  model,
}: {
  model: TreeSidebarModel
}) {
  const { classes } = useStyles()
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null)

  const {
    hierarchy,
    treeAreaWidth,
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
    [model],
  )

  const mouseoverCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMouseoverCanvasRef(ref)
    },
    [model],
  )

  function hitTestNode(event: React.MouseEvent) {
    if (spatialIndex) {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top + scrollTop
      // node.y = tree depth → horizontal, node.x = row → vertical. Overlapping
      // hit boxes come back in tree order, so pick the node whose center is
      // nearest the cursor rather than an arbitrary first match.
      let bestIdx: number | undefined
      let best = Infinity
      for (const idx of spatialIndex.index.search(x, y, x, y)) {
        const node = spatialIndex.nodes[idx]!
        const dx = node.y - x
        const dy = node.x - y
        const d = dx * dx + dy * dy
        if (d < best) {
          best = d
          bestIdx = idx
        }
      }
      return bestIdx === undefined ? undefined : spatialIndex.nodes[bestIdx]
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

  const contentHeight = treeContentHeight(model)

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
          data-testid="tree_sidebar_dendrogram"
          ref={treeCanvasRef}
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
          }}
          className={classes.resizeHandle}
          style={{
            position: 'absolute',
            top: lineZoneHeight,
            height: contentHeight,
            width: TREE_RESIZE_HANDLE_WIDTH,
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
