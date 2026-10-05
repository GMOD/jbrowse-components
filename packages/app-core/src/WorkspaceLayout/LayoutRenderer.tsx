import { Fragment } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { PanelView } from './PanelView.tsx'
import { pairSpan, withBoundaryAt } from './splitter.ts'
import { isBranch } from './tree.ts'
import { usePointerGesture } from './usePointerGesture.ts'
import { workspaceTheme } from './workspaceTheme.ts'

import type { WorkspaceLayout } from './model.ts'
import type { PanelChrome } from './panelChrome.ts'
import type { BranchNode, LayoutTree } from './tree.ts'
import type { DragState } from './useLayoutDrag.ts'

interface Props {
  node: LayoutTree
  layout: WorkspaceLayout
  /** the app's half of a panel, forwarded unchanged all the way down */
  chrome: PanelChrome
  /** the in-flight drag, so the cell under the pointer can show where it lands */
  drag?: DragState
}

/**
 * A node's share of its parent's space, as `flex-grow`, so window resizes need
 * no code. `min*: 0` stops a wide view pushing its cell past its share.
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

/** The pixels the two panes either side of a handle occupy. */
function measurePairPx(
  handle: HTMLElement,
  index: number,
  horizontal: boolean,
) {
  const panes = [...(handle.parentElement?.children ?? [])].filter(
    el => !Object.hasOwn((el as HTMLElement).dataset, 'splitter'),
  )
  const before = panes[index - 1]?.getBoundingClientRect()
  const after = panes[index]?.getBoundingClientRect()
  if (!before || !after) {
    return 0
  }
  return horizontal ? before.width + after.width : before.height + after.height
}

// a transparent grab strip with a 1px line drawn down its middle
const useSplitterStyles = makeStyles()({
  splitter: {
    flex: `0 0 ${workspaceTheme.splitterSize}px`,
    position: 'relative',
    background: 'transparent',
    touchAction: 'none',
    '&:focus-visible': {
      outline: `2px solid ${workspaceTheme.accent}`,
      outlineOffset: -1,
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      background: workspaceTheme.splitterLine,
    },
  },
  horizontal: {
    '&::before': { top: 0, bottom: 0, left: '50%', width: 1 },
  },
  vertical: {
    '&::before': { left: 0, right: 0, top: '50%', height: 1 },
  },
})

/**
 * Drags the boundary between children `index - 1` and `index`; `splitter.ts`
 * decides where it may land.
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
  const { classes, cx } = useSplitterStyles()
  const horizontal = branch.direction === 'row'

  const gesture = usePointerGesture({
    start(event) {
      const pairPx = measurePairPx(event.currentTarget, index, horizontal)
      return pairPx > 0
        ? {
            axis: horizontal ? ('clientX' as const) : ('clientY' as const),
            start: horizontal ? event.clientX : event.clientY,
            pairPx,
            startSizes: branch.children.map(c => c.size),
          }
        : undefined
    },
    move(drag, event) {
      const delta = (event[drag.axis] - drag.start) / drag.pairPx
      const sizes = drag.startSizes
      layout.setSizes(
        branch.id,
        withBoundaryAt(
          sizes,
          index,
          sizes[index - 1]! + delta * pairSpan(sizes, index),
          drag.pairPx,
        ),
      )
    },
  })

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const sizes = branch.children.map(c => c.size)
    const pair = pairSpan(sizes, index)
    const decrease = horizontal ? 'ArrowLeft' : 'ArrowUp'
    const increase = horizontal ? 'ArrowRight' : 'ArrowDown'
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
    layout.setSizes(
      branch.id,
      withBoundaryAt(
        sizes,
        index,
        moved,
        measurePairPx(event.currentTarget, index, horizontal),
      ),
    )
  }

  // the pane before the handle, as a percentage of the pair it divides
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
      onPointerDown={gesture.onPointerDown}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
      onPointerCancel={gesture.onPointerCancel}
      onLostPointerCapture={gesture.onLostPointerCapture}
      className={cx(
        classes.splitter,
        horizontal ? classes.horizontal : classes.vertical,
      )}
      style={{ cursor: horizontal ? 'ew-resize' : 'ns-resize' }}
    />
  )
})
