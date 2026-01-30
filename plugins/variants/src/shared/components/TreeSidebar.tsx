import { useCallback, useEffect, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Menu, MenuItem, alpha } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { SIDEBAR_BACKGROUND_OPACITY } from '../constants.ts'

import type { ClusterHierarchyNode, TreeSidebarModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface MenuAnchor {
  x: number
  y: number
  names: string[]
}

const useStyles = makeStyles()(theme => ({
  resizeHandle: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: 4,
    zIndex: 101,
    background: 'transparent',
    '&:hover': {
      background: theme.palette.divider,
    },
  },
  treeBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    background: alpha(
      theme.palette.background.paper,
      SIDEBAR_BACKGROUND_OPACITY,
    ),
  },
}))

function getDescendantNames(node: ClusterHierarchyNode): string[] {
  if (!node.children?.length) {
    return [node.data.name]
  }
  return node.children.flatMap(child => getDescendantNames(child))
}

/**
 * TreeSidebar renders a hierarchical cluster tree alongside the variant display.
 *
 * Architecture:
 * - treeCanvas: Draws the tree structure lines (via treeDrawingAutorun)
 * - mouseoverCanvas: Draws hover highlights spanning full width (via treeDrawingAutorun)
 * - interaction div: Captures mouse events over the tree area
 *
 * The sticky container keeps the tree visible when the parent scrolls.
 * The tree drawing uses translate(-scrollTop) to show the correct portion.
 */
const TreeSidebar = observer(function TreeSidebar({
  model,
}: {
  model: TreeSidebarModel
}) {
  const { classes } = useStyles()
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  const [nodeIndex, setNodeIndex] = useState<Flatbush | null>(null)
  const [nodeData, setNodeData] = useState<ClusterHierarchyNode[]>([])
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null)

  const { hierarchy, treeAreaWidth, height, scrollTop, showTree, sources } =
    model

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const treeCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setTreeCanvasRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, treeAreaWidth, height],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const mouseoverCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMouseoverCanvasRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, viewWidth, height],
  )

  // Build spatial index for tree branch nodes to enable hover detection
  useEffect(() => {
    return autorun(
      function treeSpatialIndexAutorun() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { treeAreaWidth: _t, hierarchy: h, totalHeight: th } = model
        // IMPORTANT: We must access these observables for MobX to track them as
        // dependencies. Without this, the autorun won't re-run when they change.
        // Do not remove - this ensures the spatial index rebuilds when row height changes.
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        th
        if (!h) {
          setNodeIndex(null)
          setNodeData([])
          return
        }

        const nodes = h.descendants().filter(node => node.children?.length)

        const index = new Flatbush(nodes.length)
        const hitRadius = 8

        for (const node of nodes) {
          const x = node.y!
          const y = node.x!
          index.add(x - hitRadius, y - hitRadius, x + hitRadius, y + hitRadius)
        }

        index.finish()
        setNodeIndex(index)
        setNodeData(nodes)
      },
      { name: 'TreeSpatialIndex' },
    )
  }, [model])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!hierarchy || !nodeIndex) {
        return
      }
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top + scrollTop

      const results = nodeIndex.search(x, y, x, y)
      const node = results.length > 0 ? nodeData[results[0]!] : undefined
      if (node) {
        model.setHoveredTreeNode({
          node,
          descendantNames: getDescendantNames(node),
        })
      } else {
        model.setHoveredTreeNode(undefined)
      }
    },
    [hierarchy, nodeIndex, nodeData, scrollTop, model],
  )

  const handleMouseLeave = useCallback(() => {
    model.setHoveredTreeNode(undefined)
  }, [model])

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!hierarchy || !nodeIndex) {
        return
      }
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top + scrollTop

      const results = nodeIndex.search(x, y, x, y)
      const node = results.length > 0 ? nodeData[results[0]!] : undefined
      if (node) {
        const descendantNames = getDescendantNames(node)
        setMenuAnchor({
          x: event.clientX,
          y: event.clientY,
          names: descendantNames,
        })
      }
    },
    [hierarchy, nodeIndex, nodeData, scrollTop],
  )

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null)
  }, [])

  if (!hierarchy || !showTree || !sources?.length) {
    return null
  }

  return (
    <>
      {/* Sticky container keeps tree visible when parent scrolls */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          height: 0,
          zIndex: 100,
        }}
      >
        {/* Tree area background */}
        <div
          className={classes.treeBackground}
          style={{
            width: treeAreaWidth,
            height,
          }}
        />
        {/* Tree structure canvas - draws lines via treeDrawingAutorun */}
        <canvas
          ref={treeCanvasRef}
          width={treeAreaWidth * 2}
          height={height * 2}
          style={{
            width: treeAreaWidth,
            height,
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
        />
        {/* Highlight canvas - draws hover highlights via treeDrawingAutorun */}
        <canvas
          ref={mouseoverCanvasRef}
          width={viewWidth}
          height={height}
          style={{
            width: viewWidth,
            height,
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
        {/* Interaction area - captures mouse events over tree */}
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: treeAreaWidth,
            height,
            zIndex: 2,
            cursor: 'pointer',
          }}
        />
      </div>
      <ResizeHandle
        onDrag={distance => {
          model.setTreeAreaWidth(Math.max(50, treeAreaWidth + distance))
          return undefined
        }}
        className={classes.resizeHandle}
        style={{
          left: treeAreaWidth,
        }}
        vertical
      />
      <Menu
        open={!!menuAnchor}
        onClose={handleCloseMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          menuAnchor ? { top: menuAnchor.y, left: menuAnchor.x } : undefined
        }
      >
        {model.subtreeFilter?.length ? (
          <MenuItem
            onClick={() => {
              model.setSubtreeFilter(undefined)
              handleCloseMenu()
            }}
          >
            Clear subtree filter
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              model.setSubtreeFilter(menuAnchor.names)
            }
            handleCloseMenu()
          }}
        >
          Show only subtree ({menuAnchor?.names.length} samples)
        </MenuItem>
      </Menu>
    </>
  )
})

export default TreeSidebar
