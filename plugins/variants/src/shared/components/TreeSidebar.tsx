import React, { useCallback, useEffect, useRef, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { autorun } from 'mobx'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

import type { MultiVariantBaseModel } from '../MultiVariantBaseModel'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

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

// Get all descendant leaf names for a node
function getDescendantNames(node: any): string[] {
  if (!node.children || node.children.length === 0) {
    return [node.data.name]
  }
  return node.children.flatMap((child: any) => getDescendantNames(child))
}

const TreeSidebar = observer(function ({
  model,
}: {
  model: Instance<ReturnType<typeof MultiVariantBaseModel>>
}) {
  const { classes } = useStyles()
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  const [nodeIndex, setNodeIndex] = useState<Flatbush | null>(null)
  const [nodeData, setNodeData] = useState<any[]>([])

  const { totalHeight, hierarchy, treeAreaWidth, height } = model as any

  if (!hierarchy) {
    return null
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const treeCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      ;(model as any).setTreeCanvasRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, treeAreaWidth, height],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const mouseoverCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      ;(model as any).setMouseoverCanvasRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, viewWidth, height],
  )

  // Build spatial index for tree nodes (branch points only) using autorun
  useEffect(() => {
    return autorun(() => {
      const { hierarchy: h, treeAreaWidth: w } = model as any
      if (!h) {
        setNodeIndex(null)
        setNodeData([])
        return
      }

      // Get all internal nodes (branch points) - exclude leaves
      const nodes = [...h.descendants()].filter(
        (node: any) => node.children && node.children.length > 0,
      )

      const index = new Flatbush(nodes.length)
      const data: any[] = []

      const hitRadius = 8 // Click radius around node

      for (const node of nodes) {
        const x = node.y
        const y = node.x!

        // Add bounding box for the node
        index.add(x - hitRadius, y - hitRadius, x + hitRadius, y + hitRadius)
        data.push(node)
      }

      index.finish()
      setNodeIndex(index)
      setNodeData(data)
    })
  }, [model])

  // Handle mouse events for tree interaction
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hierarchy || !nodeIndex) {
      return
    }

    const { scrollTop } = model as any
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top + scrollTop // Adjust for scroll position

    // Use flatbush to find nearby nodes (branch points)
    const results = nodeIndex.search(x, y, x, y)

    if (results.length > 0) {
      // Get the closest node
      const node = nodeData[results[0]!]!
      ;(model as any).setHoveredTreeNode({
        node,
        descendantNames: getDescendantNames(node),
      })
    } else {
      ;(model as any).setHoveredTreeNode(undefined)
    }
  }

  const handleMouseLeave = () => {
    ;(model as any).setHoveredTreeNode(undefined)
  }

  return (
    <>
      {/* Tree structure canvas */}
      <canvas
        ref={treeCanvasRef}
        width={treeAreaWidth}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 100,
          pointerEvents: 'none',
        }}
      />
      {/* Mouseover interaction canvas - spans full width for highlighting */}
      <canvas
        ref={mouseoverCanvasRef}
        width={viewWidth}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 101,
          cursor: 'pointer',
          pointerEvents: 'none',
        }}
      />
      {/* Invisible interaction area over tree only */}
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: treeAreaWidth,
          height,
          zIndex: 102,
          cursor: 'pointer',
        }}
      />
      <ResizeHandle
        onDrag={(distance: number) => {
          ;(model as any).setTreeAreaWidth(Math.max(50, treeAreaWidth + distance))
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
