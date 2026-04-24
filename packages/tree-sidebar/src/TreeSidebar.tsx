import { useCallback, useEffect, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { Menu, MenuItem, alpha } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { getLeafNames } from './clusterUtils.ts'
import { descendants } from './hierarchy.ts'

import type { ClusterHierarchyNode, TreeSidebarModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface MenuAnchor {
  x: number
  y: number
  names: string[]
}

const TreeSidebar = observer(function TreeSidebar({
  model,
}: {
  model: TreeSidebarModel
}) {
  const { width: viewWidth } = getContainingView(model) as LinearGenomeViewModel
  const [spatialIndex, setSpatialIndex] = useState<{
    index: Flatbush
    nodes: ClusterHierarchyNode[]
  } | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null)

  const {
    hierarchy,
    treeAreaWidth,
    height,
    lineZoneHeight = 0,
    scrollTop = 0,
    showTree,
    sources,
  } = model

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const treeCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setTreeCanvasRef(ref)
    },
    [model, treeAreaWidth, height, lineZoneHeight],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const mouseoverCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMouseoverCanvasRef(ref)
    },
    [model, viewWidth, height, lineZoneHeight],
  )

  useEffect(() => {
    return autorun(
      function treeSpatialIndexAutorun() {
        const h = model.hierarchy
        // touch treeAreaWidth and totalHeight so MobX tracks them as dependencies
        void model.treeAreaWidth
        void model.totalHeight
        if (h) {
          const nodes = descendants(h).filter(node => node.children?.length)
          const index = new Flatbush(nodes.length)
          const hitRadius = 8
          for (const node of nodes) {
            const x = node.y!
            const y = node.x!
            index.add(
              x - hitRadius,
              y - hitRadius,
              x + hitRadius,
              y + hitRadius,
            )
          }
          index.finish()
          setSpatialIndex({ index, nodes })
        } else {
          setSpatialIndex(null)
        }
      },
      { name: 'TreeSpatialIndex' },
    )
  }, [model])

  function hitTestNode(event: React.MouseEvent) {
    if (spatialIndex) {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top + scrollTop
      const results = spatialIndex.index.search(x, y, x, y)
      return results.length > 0 ? spatialIndex.nodes[results[0]!] : undefined
    }
    return undefined
  }

  function handleMouseMove(event: React.MouseEvent) {
    const node = hitTestNode(event)
    model.setHoveredTreeNode(
      node ? { node, descendantNames: getLeafNames(node) } : undefined,
    )
  }

  function handleClick(event: React.MouseEvent) {
    const node = hitTestNode(event)
    if (node) {
      setMenuAnchor({
        x: event.clientX,
        y: event.clientY,
        names: getLeafNames(node),
      })
    }
  }

  if (!hierarchy || !showTree || !sources?.length) {
    return null
  }

  const contentHeight = height - lineZoneHeight

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
          style={{
            position: 'absolute',
            top: lineZoneHeight,
            left: 0,
            width: treeAreaWidth,
            height: contentHeight,
            background: alpha('#fff', 0.8),
          }}
        />
        <canvas
          ref={treeCanvasRef}
          width={treeAreaWidth * 2}
          height={contentHeight * 2}
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
          width={viewWidth}
          height={contentHeight}
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
            model.setHoveredTreeNode(undefined)
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
      </div>
      <ResizeHandle
        onDrag={distance => {
          model.setTreeAreaWidth(Math.max(10, treeAreaWidth + distance))
          return undefined
        }}
        style={{
          position: 'absolute',
          top: lineZoneHeight,
          height: `calc(100% - ${lineZoneHeight}px)`,
          width: 4,
          zIndex: 101,
          left: treeAreaWidth,
        }}
        vertical
      />
      <Menu
        open={!!menuAnchor}
        onClose={() => {
          setMenuAnchor(null)
        }}
        anchorReference="anchorPosition"
        anchorPosition={
          menuAnchor ? { top: menuAnchor.y, left: menuAnchor.x } : undefined
        }
      >
        {model.subtreeFilter?.length ? (
          <MenuItem
            onClick={() => {
              model.setSubtreeFilter(undefined)
              setMenuAnchor(null)
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
            setMenuAnchor(null)
          }}
        >
          Show only subtree ({menuAnchor!.names.length} samples)
        </MenuItem>
      </Menu>
    </>
  )
})

export default TreeSidebar
