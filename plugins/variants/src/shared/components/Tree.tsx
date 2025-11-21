import React from 'react'

import { observer } from 'mobx-react'

// Get all descendant leaf names for a node
function getDescendantNames(node: any): string[] {
  if (!node.children || node.children.length === 0) {
    return [node.data.name]
  }
  return node.children.flatMap((child: any) => getDescendantNames(child))
}

interface TreeModel {
  rowHeight: number
  hierarchy: any
  hoveredTreeNode?: { node: any; descendantNames: string[] }
  treeAreaWidth: number
  setHoveredTreeNode: (node: any) => void
}

const Tree = observer(function ({ model }: { model: TreeModel }) {
  const { rowHeight, hierarchy, hoveredTreeNode, treeAreaWidth } = model

  return (
    <>
      {hierarchy
        ? [...hierarchy.links()].map(link => {
            const { source, target } = link
            const sy = source.x!
            const ty = target.x!
            const tx = target.y
            const sx = source.y
            const key = [sy, ty, tx, sx].join('-')

            return (
              <React.Fragment key={key}>
                <line
                  stroke="black"
                  strokeWidth={1}
                  x1={sx}
                  y1={sy}
                  x2={sx}
                  y2={ty}
                  pointerEvents="none"
                />
                <line
                  stroke="black"
                  strokeWidth={1}
                  x1={sx}
                  y1={ty}
                  x2={tx}
                  y2={ty}
                  pointerEvents="none"
                />
                {/* Invisible wider lines for easier mouseover */}
                <line
                  stroke="transparent"
                  strokeWidth={2}
                  x1={sx}
                  y1={sy}
                  x2={sx}
                  y2={ty}
                  style={{ cursor: 'pointer' }}
                  pointerEvents="stroke"
                  onMouseEnter={() => {
                    model.setHoveredTreeNode({
                      node: source,
                      descendantNames: getDescendantNames(source),
                    })
                  }}
                  onMouseLeave={() => {
                    model.setHoveredTreeNode(undefined)
                  }}
                />
                <line
                  stroke="transparent"
                  strokeWidth={10}
                  x1={sx}
                  y1={ty}
                  x2={tx}
                  y2={ty}
                  style={{ cursor: 'pointer' }}
                  pointerEvents="stroke"
                  onMouseEnter={() => {
                    model.setHoveredTreeNode({
                      node: target,
                      descendantNames: getDescendantNames(target),
                    })
                  }}
                  onMouseLeave={() => {
                    model.setHoveredTreeNode(undefined)
                  }}
                />
              </React.Fragment>
            )
          })
        : null}
      {/* Highlight hovered tree node descendants */}
      {hierarchy && hoveredTreeNode
        ? hoveredTreeNode.descendantNames.map((name: string) => {
            const leaf = hierarchy
              .leaves()
              .find((l: any) => l.data.name === name)
            if (leaf) {
              const y = leaf.x!
              return (
                <rect
                  key={name}
                  x={0}
                  y={y - rowHeight / 2}
                  width={treeAreaWidth}
                  height={rowHeight}
                  fill="rgba(255,165,0,0.2)"
                  pointerEvents="none"
                />
              )
            }
            return null
          })
        : null}
    </>
  )
})

export default Tree
