import { useCallback, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Menu, MenuItem, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import { ClusterProvenanceHint } from './ClusterProvenanceHint.tsx'
import { StaleTreeHint } from './StaleTreeHint.tsx'
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
// Both the halo and the panel below take their color from the theme rather than
// a literal white: they sit over the rendering canvas, and a hardcoded white
// panel made the whole sidebar a bright rectangle on a dark-themed track (the
// row labels beside it were already `background.paper`). `treeStroke` moves with
// them so the branch lines stay legible against the panel in either mode.
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
      boxShadow: `0 0 0 1px ${alpha(theme.palette.background.paper, 0.6)}`,
      transition: 'opacity 100ms',
    },
    '&:hover::after': {
      opacity: 1,
    },
  },
  // OPAQUE, not the 0.8 it used to be. The rendering canvas runs the full track
  // width and the sidebar overlays its left edge, so a translucent panel let a
  // fifth of the painting through behind the dendrogram — and since that
  // painting is a categorical color per row, what came through was a clean
  // vertical band in the track's own palette, one tint per row, sitting exactly
  // where a group swatch would sit. Reviewers read it as a legend they could not
  // decode ("I can't see the sidebar label colors, they exactly match the colors
  // used in the track"). The data behind the panel was never legible at 20%
  // anyway; the cost of hiding it is the left ~5% of the view, and the benefit is
  // that the gutter now means nothing unless something is drawn in it.
  panel: {
    position: 'absolute',
    left: 0,
    background: theme.palette.background.paper,
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
    // while the subtree popover is open, freeze the highlight on the clicked
    // node rather than tracking the cursor
    if (!menuAnchor) {
      const node = hitTestNode(event)
      // only write on an actual change: every write walks the subtree for its
      // leaf names and repaints the full view-width hover canvas, and mousemove
      // fires many times within one node's hit box
      if (node !== model.hoveredTreeNode?.node) {
        model.setHoveredTreeNode(
          node ? { node, descendantNames: getLeafNames(node) } : undefined,
        )
      }
    }
  }

  function handleClick(event: React.MouseEvent) {
    const node = hitTestNode(event)
    if (node) {
      const names = getLeafNames(node)
      // keep the subtree highlighted for as long as its popover is open — the
      // cursor leaves the tree onto the menu backdrop, which would otherwise
      // clear the hover via onMouseLeave
      model.setHoveredTreeNode({ node, descendantNames: names })
      setMenuAnchor({ x: event.clientX, y: event.clientY, names })
    }
  }

  function closeMenu() {
    setMenuAnchor(null)
    model.setHoveredTreeNode(undefined)
  }

  function applyFilter(names?: string[]) {
    model.setSubtreeFilter(names)
    // the filter re-lays-out the tree from y=0; without this the old scroll
    // offset strands the (usually shorter) subtree at the bottom, out of view
    model.setScrollTop?.(0)
    closeMenu()
  }

  if (!hierarchy || !showTree || !sources?.length) {
    // one of those is "there IS a tree, it just doesn't describe these rows any
    // more" — which needs saying rather than silently drawing nothing
    return <StaleTreeHint model={model} />
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
          className={classes.panel}
          style={{
            top: lineZoneHeight,
            width: treeAreaWidth,
            height: contentHeight,
          }}
        />
        <ClusterProvenanceHint model={model} top={lineZoneHeight} />
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
            // keep the highlight while the popover is open
            if (!menuAnchor) {
              model.setHoveredTreeNode(undefined)
            }
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
        onClose={closeMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          menuAnchor ? { top: menuAnchor.y, left: menuAnchor.x } : undefined
        }
      >
        {model.subtreeFilter?.length ? (
          <MenuItem
            onClick={() => {
              applyFilter(undefined)
            }}
          >
            Clear subtree filter
          </MenuItem>
        ) : null}
        {menuAnchor ? (
          <MenuItem
            onClick={() => {
              applyFilter(menuAnchor.names)
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
