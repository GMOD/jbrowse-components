import React, { useEffect, useRef, useMemo } from 'react'

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
    zIndex: 1001,
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
  const { totalHeight, hierarchy, treeAreaWidth } = model as any
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseoverCanvasRef = useRef<HTMLCanvasElement>(null)

  if (!hierarchy) {
    return null
  }

  // Build spatial index for tree nodes (branch points only)
  const { nodeIndex, nodeData } = useMemo(() => {
    if (!hierarchy) {
      return { nodeIndex: null, nodeData: [] }
    }

    // Get all internal nodes (branch points) - exclude leaves
    const nodes = [...hierarchy.descendants()].filter(
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
    return { nodeIndex: index, nodeData: data }
  }, [hierarchy])

  // Draw tree structure
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !hierarchy) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.clearRect(0, 0, treeAreaWidth, totalHeight)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1

    // Draw all tree links
    for (const link of hierarchy.links()) {
      const { source, target } = link
      const sy = source.x!
      const ty = target.x!
      const tx = target.y
      const sx = source.y

      // Vertical line
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx, ty)
      ctx.stroke()

      // Horizontal line
      ctx.beginPath()
      ctx.moveTo(sx, ty)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }
  }, [hierarchy, treeAreaWidth, totalHeight])

  // Draw hover highlights
  useEffect(() => {
    const canvas = mouseoverCanvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    return autorun(() => {
      const { rowHeight, hoveredTreeNode } = model as any
      ctx.clearRect(0, 0, viewWidth, totalHeight)

      if (hierarchy && hoveredTreeNode) {
        // Draw highlight rectangles for descendant rows
        ctx.fillStyle = 'rgba(255,165,0,0.2)'
        for (const name of hoveredTreeNode.descendantNames) {
          const leaf = hierarchy.leaves().find((l: any) => l.data.name === name)
          if (leaf) {
            const y = leaf.x!
            ctx.fillRect(0, y - rowHeight / 2, viewWidth, rowHeight)
          }
        }

        // Draw circle at the hovered node
        const { node } = hoveredTreeNode
        ctx.fillStyle = 'rgba(255,165,0,0.8)'
        ctx.beginPath()
        ctx.arc(node.y, node.x, 4, 0, 2 * Math.PI)
        ctx.fill()

        // Optional: add a border to the circle
        ctx.strokeStyle = 'rgba(255,140,0,1)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    })
  }, [model, hierarchy, viewWidth, totalHeight])

  // Handle mouse events for tree interaction
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hierarchy || !nodeIndex) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

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
        ref={canvasRef}
        width={treeAreaWidth}
        height={totalHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1000,
          pointerEvents: 'none',
        }}
      />
      {/* Mouseover interaction canvas - spans full width for highlighting */}
      <canvas
        ref={mouseoverCanvasRef}
        width={viewWidth}
        height={totalHeight}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1001,
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
          height: totalHeight,
          zIndex: 1002,
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
