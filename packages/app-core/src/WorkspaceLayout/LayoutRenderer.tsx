import { Fragment, useCallback, useRef } from 'react'

import { observer } from 'mobx-react'

import { indicatorRect } from './dropZone.ts'

import type { DropZone } from './dropZone.ts'
import type { WorkspaceLayout } from './model.ts'
import type { BranchNode, LayoutTree } from './tree.ts'
import type { DragState } from './useLayoutDrag.ts'

/**
 * The layout, rendered. There is no imperative api and no event to listen to:
 * the tree is state, this is a function of it, and a gesture is an action.
 *
 * Sizes are `flex-grow`, which is why there is no resize handling anywhere in
 * here. A branch's children divide its space in proportion to their `size`
 * whatever that space becomes, so a window resize is the browser's problem —
 * this is the layout maths dockview does in pixels, and it is the part of a
 * grid engine most likely to be got subtly wrong.
 */

interface Props {
  node: LayoutTree
  layout: WorkspaceLayout
  renderPanel: (panelId: string, viewIds: string[]) => React.ReactNode
  /** the in-flight drag, so the panel under the pointer can show where it lands */
  drag?: DragState
}

export const LayoutRenderer = observer(function LayoutRenderer({
  node,
  layout,
  renderPanel,
  drag,
}: Props) {
  if (!('children' in node)) {
    return (
      <div
        data-panel-id={node.id}
        style={{
          position: 'relative',
          flexGrow: node.size,
          flexBasis: 0,
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {renderPanel(node.id, node.viewIds)}
        {drag?.panelId === node.id && <DropIndicator zone={drag.zone} />}
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: node.direction,
        flexGrow: node.size,
        flexBasis: 0,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {node.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && <Splitter branch={node} index={i} layout={layout} />}
          <LayoutRenderer
            node={child}
            layout={layout}
            renderPanel={renderPanel}
            drag={drag}
          />
        </Fragment>
      ))}
    </div>
  )
})

/**
 * Drags the boundary between children `index - 1` and `index`.
 *
 * Reads the two panes' real pixel sizes on pointerdown and moves the boundary
 * within their combined space, so only the pair either side of the handle
 * changes — every other pane holds still, which is what a splitter is expected
 * to do and what "just scale everything" gets wrong.
 */
const Splitter = observer(function Splitter({
  branch,
  index,
  layout,
}: {
  branch: BranchNode
  index: number
  layout: WorkspaceLayout
}) {
  const dragRef = useRef<{
    axis: 'clientX' | 'clientY'
    start: number
    pairPx: number
    startSizes: number[]
  }>(undefined)

  const horizontal = branch.direction === 'row'

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const container = event.currentTarget.parentElement
      if (!container) {
        return
      }
      // every other child of this flex container, in order; the two panes are
      // the elements either side of this handle
      const panes = [...container.children].filter(
        el => !Object.hasOwn((el as HTMLElement).dataset, 'splitter'),
      )
      const before = panes[index - 1]?.getBoundingClientRect()
      const after = panes[index]?.getBoundingClientRect()
      if (!before || !after) {
        return
      }
      dragRef.current = {
        axis: horizontal ? 'clientX' : 'clientY',
        start: horizontal ? event.clientX : event.clientY,
        pairPx: horizontal
          ? before.width + after.width
          : before.height + after.height,
        startSizes: branch.children.map(c => c.size),
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [branch, index, horizontal],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pairPx <= 0) {
        return
      }
      const delta = (event[drag.axis] - drag.start) / drag.pairPx
      const pairShare = drag.startSizes[index - 1]! + drag.startSizes[index]!
      // clamped so a pane can be dragged to nothing but never through zero,
      // which would flip the pair and make the handle jump
      const next = [...drag.startSizes]
      const moved = Math.min(
        Math.max(drag.startSizes[index - 1]! + delta * pairShare, 0),
        pairShare,
      )
      next[index - 1] = moved
      next[index] = pairShare - moved
      layout.setSizes(branch.id, next)
    },
    [branch.id, index, layout],
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = undefined
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    [],
  )

  return (
    <div
      data-splitter
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        flex: '0 0 4px',
        cursor: horizontal ? 'col-resize' : 'row-resize',
        background: 'rgba(128,128,128,0.35)',
        touchAction: 'none',
      }}
    />
  )
})

/**
 * Where the view would land if released now. Half the panel for an edge, the
 * whole panel for a tab drop — the same shape dockview draws, because it reads
 * unambiguously and users already know it.
 */
const DropIndicator = observer(function DropIndicator({
  zone,
}: {
  zone: DropZone
}) {
  return (
    <div
      data-drop-indicator={zone}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        background: 'rgba(64,128,255,0.30)',
        outline: '1px solid rgba(64,128,255,0.8)',
        ...indicatorRect(zone),
      }}
    />
  )
})
