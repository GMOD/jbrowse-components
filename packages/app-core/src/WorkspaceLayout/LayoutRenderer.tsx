import { Fragment, useCallback, useRef } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { PanelView } from './PanelView.tsx'
import { dv } from './dockviewTheme.ts'
import { isBranch } from './tree.ts'

import type { WorkspaceLayout } from './model.ts'
import type { PanelChrome } from './panelChrome.ts'
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
  /** the app's half of a panel, forwarded unchanged all the way down */
  chrome: PanelChrome
  /** the in-flight drag, so the cell under the pointer can show where it lands */
  drag?: DragState
}

/**
 * A node's share of its parent's space.
 *
 * `flexGrow: size` with `flexBasis: 0` is the whole grid engine: the children
 * divide whatever space the parent has in proportion to their sizes, so a
 * window resize is the browser's problem. The two `min*: 0` are what stop a
 * flex item refusing to shrink below its content — without them a wide view
 * pushes its own cell past its share.
 */
function paneStyle(size: number): React.CSSProperties {
  return {
    display: 'flex',
    flexGrow: size,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 0,
  }
}

export const LayoutRenderer = observer(function LayoutRenderer(props: Props) {
  const { node, layout, drag } = props
  if (!isBranch(node)) {
    return (
      <div style={paneStyle(node.size)}>
        <PanelView
          panel={node}
          layout={layout}
          chrome={props.chrome}
          drop={drag?.panelId === node.id ? drag : undefined}
        />
      </div>
    )
  }
  return (
    <div style={{ ...paneStyle(node.size), flexDirection: node.direction }}>
      {node.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && <Splitter branch={node} index={i} layout={layout} />}
          <LayoutRenderer {...props} node={child} />
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
// dockview's sash is a transparent grab strip with a 1px separator line drawn
// down the middle of it — the line is what you see, the 4px is what you can
// hit. Its dark theme deliberately gives the sash no hover colour at all.
/** The space the two panes either side of the boundary before `index` share. */
function pairSpan(sizes: number[], index: number) {
  return sizes[index - 1]! + sizes[index]!
}

/**
 * `sizes` with that boundary moved to `position`, measured in the same units.
 *
 * The move stays inside the pair, so every other pane holds still — what a
 * splitter is expected to do, and what "just scale everything" gets wrong. The
 * clamp lets a pane be dragged to nothing but never through zero, which would
 * flip the pair and make the handle jump. The pointer and the arrow keys are
 * the same gesture at different resolutions and both land here.
 */
function withBoundaryAt(sizes: number[], index: number, position: number) {
  const pair = pairSpan(sizes, index)
  const before = Math.min(Math.max(position, 0), pair)
  const next = [...sizes]
  next[index - 1] = before
  next[index] = pair - before
  return next
}

const useSplitterStyles = makeStyles()({
  splitter: {
    flex: `0 0 ${dv.sashSize}px`,
    position: 'relative',
    background: 'transparent',
    touchAction: 'none',
    // it is focusable, so it has to show focus — dockview's sash deliberately
    // has no HOVER colour, which is a different thing and still holds
    '&:focus-visible': {
      outline: `2px solid ${dv.edgeDockIndicatorColor}`,
      outlineOffset: -1,
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      background: dv.separatorBorder,
    },
  },
  horizontal: {
    '&::before': { top: 0, bottom: 0, left: '50%', width: 1 },
  },
  vertical: {
    '&::before': { left: 0, right: 0, top: '50%', height: 1 },
  },
})

const Splitter = observer(function Splitter({
  branch,
  index,
  layout,
}: {
  branch: BranchNode
  index: number
  layout: WorkspaceLayout
}) {
  const { classes, cx } = useSplitterStyles()
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
      // the pointer's travel as a fraction of the pair's pixels, applied to the
      // pair's share — so the handle tracks the pointer whatever the units are
      const delta = (event[drag.axis] - drag.start) / drag.pairPx
      const sizes = drag.startSizes
      layout.setSizes(
        branch.id,
        withBoundaryAt(
          sizes,
          index,
          sizes[index - 1]! + delta * pairSpan(sizes, index),
        ),
      )
    },
    [branch.id, index, layout],
  )

  const endDrag = useCallback(() => {
    dragRef.current = undefined
  }, [])

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = undefined
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    [],
  )

  // A `separator` that can be moved is focusable and takes the arrow keys; one
  // that cannot is just decoration and should not claim the role. This one
  // claimed it while being neither focusable nor operable, which announces an
  // affordance to a screen reader that its user then cannot find.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const sizes = branch.children.map(c => c.size)
      const pair = pairSpan(sizes, index)
      const decrease = horizontal ? 'ArrowLeft' : 'ArrowUp'
      const increase = horizontal ? 'ArrowRight' : 'ArrowDown'
      // 2% of the PAIR per press, matching the drag: the boundary moves within
      // the two panes either side of it and every other pane holds still
      const step = pair * 0.02
      let moved: number | undefined
      if (event.key === decrease) {
        moved = sizes[index - 1]! - step
      } else if (event.key === increase) {
        moved = sizes[index - 1]! + step
      } else if (event.key === 'Home') {
        moved = 0
      } else if (event.key === 'End') {
        moved = pair
      }
      if (moved === undefined) {
        return
      }
      event.preventDefault()
      layout.setSizes(branch.id, withBoundaryAt(sizes, index, moved))
    },
    [branch, index, horizontal, layout],
  )

  // the pane BEFORE the handle, as a percentage of the pair it divides — which
  // is what the handle actually moves
  const sizes = branch.children.map(c => c.size)
  const valueNow = Math.round(
    (sizes[index - 1]! / pairSpan(sizes, index)) * 100,
  )

  return (
    <div
      data-splitter
      role="separator"
      tabIndex={0}
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label={horizontal ? 'Resize panels' : 'Resize rows'}
      aria-valuenow={valueNow}
      aria-valuemin={0}
      aria-valuemax={100}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      // capture can end without a pointerup — the browser drops it if the
      // element is removed, and then the next pointer that merely passes over
      // the handle would go on resizing from the stale start sizes
      onLostPointerCapture={endDrag}
      className={cx(
        classes.splitter,
        horizontal ? classes.horizontal : classes.vertical,
      )}
      style={{ cursor: horizontal ? 'ew-resize' : 'ns-resize' }}
    />
  )
})
