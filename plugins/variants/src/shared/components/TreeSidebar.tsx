import { useCallback, useEffect, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { TreeSidebarModel } from './types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
}))

function getDescendantNames(node: any): string[] {
  if (!node.children || node.children.length === 0) {
    return [node.data.name]
  }
  return node.children.flatMap((child: any) => getDescendantNames(child))
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
const TreeSidebar = observer(function ({ model }: { model: TreeSidebarModel }) {
  const { classes } = useStyles()
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  const [nodeIndex, setNodeIndex] = useState<Flatbush | null>(null)
  const [nodeData, setNodeData] = useState<any[]>([])

  const { hierarchy, treeAreaWidth, height, scrollTop, showTree } = model

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
        // it is required to access treeAreaWidth here for the autorun to respond
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { treeAreaWidth: _t, hierarchy: h, totalHeight: th } = model
        // Access totalHeight to rebuild index when row height changes
        void th
        if (!h) {
          setNodeIndex(null)
          setNodeData([])
          return
        }

        const nodes = [...h.descendants()].filter(
          (node: any) => node.children && node.children.length > 0,
        )

        const index = new Flatbush(nodes.length)
        const data: any[] = []
        const hitRadius = 8

        for (const node of nodes) {
          const x = node.y
          const y = node.x!
          index.add(x - hitRadius, y - hitRadius, x + hitRadius, y + hitRadius)
          data.push(node)
        }

        index.finish()
        setNodeIndex(index)
        setNodeData(data)
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
      if (results.length > 0) {
        const node = nodeData[results[0]!]!
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

  if (!hierarchy || !showTree) {
    return null
  }

  return (
    <>
      {/* Sticky container keeps tree visible when parent scrolls */}
      <div
        style={{ position: 'sticky', top: 0, left: 0, height: 0, zIndex: 100 }}
      >
        {/* Tree structure canvas - draws lines via treeDrawingAutorun */}
        <canvas
          ref={treeCanvasRef}
          width={treeAreaWidth}
          height={height}
          style={{
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
    </>
  )
})

export default TreeSidebar
