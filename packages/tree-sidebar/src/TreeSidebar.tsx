import { useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TrackOverlayPortal } from '@jbrowse/plugin-linear-genome-view'
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
import type { ReactNode } from 'react'

interface MenuAnchor {
  x: number
  y: number
  names: string[]
}

/**
 * The zero-height box every part of the sidebar hangs off, so the portaled layer
 * and the inline one are laid out by one rule and cannot drift apart.
 *
 * `absolute`, not the `sticky` the sidebar used to carry: nothing above it
 * scrolls natively — `TrackRenderingContainer` deliberately has no `overflow`,
 * and every row display paints a fixed canvas at `-scrollTop` instead — so the
 * only scrollport sticky could ever have found was the window. In an embedded,
 * page-scrolling host that would peel the sidebar off the rows it labels, and
 * now that it is two layers, peel them off each other.
 */
function GutterLayer({ top, children }: { top: number; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', top, left: 0, height: 0, zIndex: 100 }}>
      {children}
    </div>
  )
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

/**
 * The dendrogram gutter, in two layers that sit on opposite sides of the LGV's
 * inter-region masks.
 *
 * What it **paints** — the opaque panel, the tree canvas, the hover canvas, the
 * hints — is portaled above those masks (`TrackOverlayPortal`), because a
 * display renders inside a `contain:strict` sandbox the masks paint over, and at
 * whole-genome or multi-region scale that put a grey separator bar through the
 * dendrogram at every region boundary. What it **hit-tests** — the transparent
 * node-picking box and the resize handle — deliberately stays inline: those draw
 * nothing, so being under the masks costs them nothing, and staying inside the
 * display keeps every pointer path they already have. In particular the portal
 * node is `pointer-events: none` (so it doesn't eat canvas events), and maf's
 * wheel-to-scroll listener is bound to the DOM element these sit in, not to the
 * React tree the portal travels through.
 *
 * The two layers share an origin and their z-indexes are still read against each
 * other, so the ordering within the gutter is unchanged.
 */
const TreeSidebar = observer(function TreeSidebar({
  model,
  top = 0,
}: {
  model: TreeSidebarModel
  // Top of the sidebar within the display's own box. Non-zero only for a display
  // that stacks something above its rows (maf's coverage/conservation bands):
  // the painted layer is portaled onto the display's origin, so an offset it
  // used to inherit from its container has to be passed explicitly. The inline
  // layer still sits in that container and so does not take it.
  top?: number
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
    // more" — which needs saying rather than silently drawing nothing. Portaled
    // for the same reason the panel is: it is text in the gutter.
    return (
      <TrackOverlayPortal>
        <GutterLayer top={top}>
          <StaleTreeHint model={model} top={lineZoneHeight} />
        </GutterLayer>
      </TrackOverlayPortal>
    )
  }

  const contentHeight = treeContentHeight(model)

  return (
    <>
      <TrackOverlayPortal>
        <GutterLayer top={top}>
          <div
            className={classes.panel}
            style={{
              top: lineZoneHeight,
              width: treeAreaWidth,
              height: contentHeight,
            }}
          />
          <ClusterProvenanceHint model={model} top={lineZoneHeight} />
          {/* the ref callbacks are the model's own actions, which are stable per
              instance — wrapping them in useCallback([model]) bought nothing */}
          <canvas
            data-testid="tree_sidebar_dendrogram"
            ref={model.setTreeCanvasRef}
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
            ref={model.setMouseoverCanvasRef}
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
        </GutterLayer>
      </TrackOverlayPortal>
      {/* the inline layer stays in the container the caller put it in, so it
          takes no `top` of its own */}
      <GutterLayer top={0}>
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
      </GutterLayer>
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
