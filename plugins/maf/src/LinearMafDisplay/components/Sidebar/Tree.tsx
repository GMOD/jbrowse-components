import React, { useCallback, useMemo } from 'react'

import { descendants, links } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../../stateModel.ts'
import type { HierarchyNode } from '../../types.ts'

const hitboxStyle = {
  pointerEvents: 'all',
  cursor: 'pointer',
  strokeWidth: 8,
  stroke: 'transparent',
} as const

const Tree = observer(function ({ model }: { model: LinearMafDisplayModel }) {
  const {
    // rowHeight is needed for redrawing after zoom change
    // eslint-disable-next-line  @typescript-eslint/no-unused-vars
    rowHeight: _rowHeight,
    treeAreaWidth,
    hierarchy,
    showBranchLen,
    nodeDescendantNames,
  } = model

  const clearHighlight = useCallback(() => {
    model.setHighlightedRowNames(undefined)
  }, [model])

  const nodeHandlers = useMemo(() => {
    const handlers = new Map<
      HierarchyNode,
      {
        onMouseEnter: () => void
        onClick: (event: React.MouseEvent) => void
      }
    >()
    if (hierarchy) {
      for (const node of descendants(hierarchy)) {
        const names = nodeDescendantNames.get(node)
        handlers.set(node, {
          onMouseEnter: () => {
            model.setHighlightedRowNames(names, {
              x: node.x!,
              y: node.y!,
            })
          },
          onClick: (event: React.MouseEvent) => {
            event.preventDefault()
            if (names && names.length > 0) {
              model.setTreeMenuAnchor({
                x: event.clientX,
                y: event.clientY,
                names,
              })
            }
          },
        })
      }
    }
    return handlers
  }, [model, hierarchy, nodeDescendantNames])

  return (
    <>
      {hierarchy
        ? links(hierarchy).map(link => {
            const { source, target } = link
            const sy = source.x!
            const ty = target.x!
            const tx = showBranchLen ? target.len : target.y
            const sx = showBranchLen ? source.len : source.y

            const sourceHandlers = nodeHandlers.get(source)
            const targetHandlers = nodeHandlers.get(target)

            return (
              <React.Fragment key={`${treeAreaWidth}-${sy}-${ty}-${tx}-${sx}`}>
                {/* Visible lines */}
                <line stroke="black" x1={sx} y1={sy} x2={sx} y2={ty} />
                <line stroke="black" x1={sx} y1={ty} x2={tx} y2={ty} />
                {/* Invisible hitbox lines */}
                <line
                  x1={sx}
                  y1={sy}
                  x2={sx}
                  y2={ty}
                  style={hitboxStyle}
                  onMouseEnter={sourceHandlers?.onMouseEnter}
                  onMouseLeave={clearHighlight}
                  onClick={sourceHandlers?.onClick}
                />
                <line
                  x1={sx}
                  y1={ty}
                  x2={tx}
                  y2={ty}
                  style={hitboxStyle}
                  onMouseEnter={targetHandlers?.onMouseEnter}
                  onMouseLeave={clearHighlight}
                  onClick={targetHandlers?.onClick}
                />
              </React.Fragment>
            )
          })
        : null}
    </>
  )
})

export default Tree
