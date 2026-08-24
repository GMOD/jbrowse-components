import { useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TrackOverlayPortal } from '@jbrowse/display-ui'
import { Menu, MenuItem, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import { ClusterProvenanceHint } from './ClusterProvenanceHint.tsx'
import { StaleTreeHint } from './StaleTreeHint.tsx'
import { getLeafNames, subtreeCoversEveryRow } from './clusterUtils.ts'
import { pickTreeNode } from './spatialIndex.ts'
import {
  TREE_RESIZE_HANDLE_WIDTH,
  clampTreeAreaWidth,
  treeContentHeight,
  treeIsShowing,
} from './treeSidebarGeometry.ts'

import type { ClusterHierarchyNode, TreeSidebarModel } from './types.ts'
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
  const view = getContainingView(model) as LinearGenomeViewModel
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null)

  const {
    treeAreaWidth,
    rowsTopOffset = 0,
    scrollTop = 0,
    sources,
    spatialIndex,
  } = model

  // What's left to apply here, on top of whatever `top` already carries. A
  // caller passing `top` (maf) has already put that amount on the ancestor the
  // inline layer sits in, and on the portaled `GutterLayer` itself — so
  // reusing `rowsTopOffset` again below double-counts it. A caller passing
  // none (variants, wiggle, multi-row) needs the full amount supplied here,
  // since nothing external is offsetting either layer.
  const innerTop = rowsTopOffset - top

  // Cursor → tree node. All this owns is the coordinate change: the hit box is
  // positioned at the top of the rows, so client coords become box-relative
  // ones, and `+ scrollTop` puts them back into the un-scrolled space the tree
  // was laid out in (the canvas beside it draws through the matching
  // `translate(0, -scrollTop)`). Which node that lands on is `pickTreeNode`'s,
  // beside the index it searches.
  function hitTestNode(event: React.MouseEvent) {
    if (!spatialIndex) {
      return undefined
    }
    const rect = event.currentTarget.getBoundingClientRect()
    return pickTreeNode(
      spatialIndex,
      event.clientX - rect.left,
      event.clientY - rect.top + scrollTop,
    )
  }

  // Hover a node and answer with its leaf names, which the caller also needs.
  // `getLeafNames` walks the whole subtree, so the two writes go through one
  // place rather than each doing that walk for itself.
  function hoverNode(node: ClusterHierarchyNode) {
    const names = getLeafNames(node)
    model.setHoveredTreeNode({ node, descendantNames: names })
    return names
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
        if (node) {
          hoverNode(node)
        } else {
          model.setHoveredTreeNode(undefined)
        }
      }
    }
  }

  function handleClick(event: React.MouseEvent) {
    const node = hitTestNode(event)
    if (node) {
      // keep the subtree highlighted for as long as its popover is open — the
      // cursor leaves the tree onto the menu backdrop, which would otherwise
      // clear the hover via onMouseLeave
      const names = hoverNode(node)
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

  // the same gate `treeSidebarOffset` reserves the gutter under, so the
  // painting and the space kept for it cannot come apart
  if (!treeIsShowing(model) || !sources?.length) {
    // one of those is "there IS a tree, it just doesn't describe these rows any
    // more" — which needs saying rather than silently drawing nothing. Portaled
    // for the same reason the panel is: it is text in the gutter.
    return (
      <TrackOverlayPortal>
        <GutterLayer top={top}>
          <StaleTreeHint model={model} top={innerTop} />
        </GutterLayer>
      </TrackOverlayPortal>
    )
  }

  const contentHeight = treeContentHeight(model)
  // Read past the early return, not with the other destructures above it. This
  // is the only consumer of the view width (the hover canvas spans the track),
  // and an observer that reads it subscribes to it — so reading it up top
  // re-rendered every sidebar on every view resize even in the far more common
  // state where there is no tree and nothing below is drawn. `width` also
  // throws before the view has been measured, which is why the drawing autorun
  // gates on `view.initialized`; here the gate is simply not needing it yet.
  const viewWidth = view.width

  return (
    <>
      <TrackOverlayPortal>
        <GutterLayer top={top}>
          <div
            className={classes.panel}
            style={{
              top: innerTop,
              width: treeAreaWidth,
              height: contentHeight,
            }}
          />
          <ClusterProvenanceHint model={model} top={innerTop} />
          {/* the ref callbacks are the model's own actions, which are stable per
              instance — wrapping them in useCallback([model]) bought nothing */}
          <canvas
            data-testid="tree_sidebar_dendrogram"
            ref={model.setTreeCanvasRef}
            style={{
              width: treeAreaWidth,
              height: contentHeight,
              position: 'absolute',
              top: innerTop,
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
              top: innerTop,
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
            top: innerTop,
            left: 0,
            width: treeAreaWidth,
            height: contentHeight,
            zIndex: 2,
            cursor: 'pointer',
          }}
        />
        <ResizeHandle
          onDrag={distance => {
            model.setTreeAreaWidth(
              clampTreeAreaWidth(treeAreaWidth + distance, viewWidth),
            )
          }}
          className={classes.resizeHandle}
          style={{
            position: 'absolute',
            top: innerTop,
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
          // Disabled where it would hide nothing (`subtreeCoversEveryRow` says
          // why), rather than hidden, so the count still answers "how many are
          // under here" — which is what a reader clicks the root to find out.
          //
          // "rows", not "samples": three of the four consumers do not have
          // samples. They are subtracks (multi-wiggle), row groups (multi-row
          // features) and genomes (maf), and rows is the word the rest of this
          // package uses for all of them.
          <MenuItem
            disabled={subtreeCoversEveryRow(menuAnchor.names, sources.length)}
            onClick={() => {
              applyFilter(menuAnchor.names)
            }}
          >
            Show only subtree ({menuAnchor.names.length} rows)
          </MenuItem>
        ) : null}
      </Menu>
    </>
  )
})

export default TreeSidebar
