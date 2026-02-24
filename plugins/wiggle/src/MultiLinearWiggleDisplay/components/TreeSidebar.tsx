import { useCallback, useEffect, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { Menu, MenuItem, alpha } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { ClusterHierarchyNode, TreeSidebarModel } from './treeTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface MenuAnchor {
  x: number
  y: number
  names: string[]
}

function getDescendantNames(node: ClusterHierarchyNode): string[] {
  if (!node.children?.length) {
    return [node.data.name]
  }
  return node.children.flatMap(child => getDescendantNames(child))
}

const TreeSidebar = observer(function TreeSidebar({
  model,
}: {
  model: TreeSidebarModel
}) {
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  const [nodeIndex, setNodeIndex] = useState<Flatbush | null>(null)
  const [nodeData, setNodeData] = useState<ClusterHierarchyNode[]>([])
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null)

  const { hierarchy, treeAreaWidth, height, showTree, sources } = model

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

  useEffect(() => {
    return autorun(
      function treeSpatialIndexAutorun() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { treeAreaWidth: _t, hierarchy: h } = model
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

  const hitTestNode = useCallback(
    (event: React.MouseEvent) => {
      if (!hierarchy || !nodeIndex) {
        return undefined
      }
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const results = nodeIndex.search(x, y, x, y)
      return results.length > 0 ? nodeData[results[0]!] : undefined
    },
    [hierarchy, nodeIndex, nodeData],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const node = hitTestNode(event)
      if (node) {
        model.setHoveredTreeNode({
          node,
          descendantNames: getDescendantNames(node),
        })
      } else {
        model.setHoveredTreeNode(undefined)
      }
    },
    [hitTestNode, model],
  )

  const handleMouseLeave = useCallback(() => {
    model.setHoveredTreeNode(undefined)
  }, [model])

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      const node = hitTestNode(event)
      if (node) {
        setMenuAnchor({
          x: event.clientX,
          y: event.clientY,
          names: getDescendantNames(node),
        })
      }
    },
    [hitTestNode],
  )

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null)
  }, [])

  if (!hierarchy || !showTree || !sources.length) {
    return null
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: treeAreaWidth,
            height,
            background: alpha('#fff', 0.8),
          }}
        />
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
        style={{
          position: 'absolute',
          top: 0,
          height: '100%',
          width: 4,
          zIndex: 101,
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
