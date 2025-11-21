import React, { useCallback, useEffect, useState } from 'react'

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

// Get all descendant leaf names for a node
function getDescendantNames(node: any): string[] {
  if (!node.children || node.children.length === 0) {
    return [node.data.name]
  }
  return node.children.flatMap((child: any) => getDescendantNames(child))
}

const TreeSidebar = observer(function ({ model }: { model: TreeSidebarModel }) {
  const { classes } = useStyles()
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  const [nodeIndex, setNodeIndex] = useState<Flatbush | null>(null)
  const [nodeData, setNodeData] = useState<any[]>([])

  // eslint-disable-next-line  @typescript-eslint/no-unused-vars
  const { totalHeight, hierarchy, treeAreaWidth, height, scrollTop } = model

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

  // Build spatial index for tree nodes (branch points only) using autorun
  useEffect(() => {
    return autorun(() => {
      // eslint-disable-next-line  @typescript-eslint/no-unused-vars
      const { hierarchy: h, treeAreaWidth: w, totalHeight: th } = model
      if (!h) {
        setNodeIndex(null)
        setNodeData([])
        return
      }

      // Get all internal nodes (branch points) - exclude leaves
      // Note: accessing totalHeight ensures we rebuild when row height changes
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

  if (!hierarchy) {
    return null
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
          top: scrollTop,
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
        onMouseMove={(event: React.MouseEvent<HTMLCanvasElement>) => {
          if (!hierarchy || !nodeIndex) {
            return
          }

          const rect = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - rect.left
          // Canvas is positioned at scrollTop, and we translate the drawing by -scrollTop,
          // so we need to account for both to get the correct tree coordinate
          const y = event.clientY - rect.top + scrollTop

          // Use flatbush to find nearby nodes (branch points)
          const results = nodeIndex.search(x, y, x, y)

          if (results.length > 0) {
            // Get the closest node
            const node = nodeData[results[0]!]!
            model.setHoveredTreeNode({
              node,
              descendantNames: getDescendantNames(node),
            })
          } else {
            model.setHoveredTreeNode(undefined)
          }
        }}
        onMouseLeave={() => {
          model.setHoveredTreeNode(undefined)
        }}
        style={{
          position: 'absolute',
          top: scrollTop,
          left: 0,
          zIndex: 101,
          cursor: 'pointer',
          pointerEvents: 'none',
        }}
      />
      {/* Invisible interaction area over tree only */}
      <div
        onMouseMove={event => {
          if (!hierarchy || !nodeIndex) {
            return
          }

          const rect = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - rect.left
          // Canvas is positioned at scrollTop, and we translate the drawing by -scrollTop,
          // so we need to account for both to get the correct tree coordinate
          const y = event.clientY - rect.top + scrollTop

          // Use flatbush to find nearby nodes (branch points)
          const results = nodeIndex.search(x, y, x, y)

          if (results.length > 0) {
            // Get the closest node
            const node = nodeData[results[0]!]!
            model.setHoveredTreeNode({
              node,
              descendantNames: getDescendantNames(node),
            })
          } else {
            model.setHoveredTreeNode(undefined)
          }
        }}
        onMouseLeave={() => {
          model.setHoveredTreeNode(undefined)
        }}
        style={{
          position: 'absolute',
          top: scrollTop,
          left: 0,
          width: treeAreaWidth,
          height,
          zIndex: 102,
          cursor: 'pointer',
        }}
      />
      <ResizeHandle
        onDrag={(distance: number) => {
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
