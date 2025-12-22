import { useCallback, useEffect, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import SvgTree from './SvgTree'

import type { ClusterHierarchyNode, TreeSidebarModel } from './types'
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

function getDescendantNames(node: ClusterHierarchyNode): string[] {
  return !node.children?.length
    ? [node.data.name]
    : node.children.flatMap(child => getDescendantNames(child))
}

/**
 * TreeSidebar renders a hierarchical cluster tree alongside the variant display.
 *
 * Architecture:
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
  const [nodeData, setNodeData] = useState<ClusterHierarchyNode[]>([])

  const { hierarchy, treeAreaWidth, height, scrollTop, showTree } = model

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
      {
        name: 'TreeSpatialIndex',
      },
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

  if (!hierarchy || !showTree) {
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
        {/* Tree structure canvas - draws lines via treeDrawingAutorun */}
        <svg
          width={treeAreaWidth * 2}
          height={height * 2}
          style={{
            position: 'absolute',
            width: treeAreaWidth,
            height,
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
        >
          <SvgTree model={model} />
        </svg>
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
