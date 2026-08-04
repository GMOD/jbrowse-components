import { useRef, useState } from 'react'

import { observer } from 'mobx-react'

import SharedTooltip from './SharedTooltip.tsx'
import TreeItem from './TreeItem.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const HierarchicalTree = observer(function HierarchicalTree({
  height,
  model,
}: {
  height: number
  model: HierarchicalTrackSelectorModel
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const { rows, treeHeight } = model
  // when the list shrinks (filter/collapse) the browser caps the real scrollTop
  // but may not fire a scroll event, leaving our state stale-high and rendering
  // a blank viewport until the next manual scroll. Written back into state
  // during render rather than only derived: the cap is what the DOM did, so
  // keeping the stale value would scroll the rendered window back down to it
  // when the list grows again, while the container is still at the top
  const maxScrollTop = Math.max(0, treeHeight - height)
  if (scrollTop > maxScrollTop) {
    setScrollTop(maxScrollTop)
  }
  const effectiveScrollTop = Math.min(scrollTop, maxScrollTop)
  const { startIndex, endIndex } = model.visibleRange(
    height,
    effectiveScrollTop,
  )

  return (
    <div
      ref={containerRef}
      style={{ height, overflowY: 'auto' }}
      onScroll={e => {
        // the overscan means most scroll events don't change which rows are
        // mounted; only re-render when they cross out of the rendered window
        const next = e.currentTarget.scrollTop
        const range = model.visibleRange(height, next)
        if (range.startIndex !== startIndex || range.endIndex !== endIndex) {
          setScrollTop(next)
        }
      }}
    >
      <div
        style={{
          height: treeHeight,
          width: '100%',
          position: 'relative',
        }}
      >
        {Array.from({ length: endIndex - startIndex + 1 }, (_, i) => {
          const row = rows[startIndex + i]
          return row ? (
            <TreeItem key={row.item.id} model={model} row={row} />
          ) : null
        })}
      </div>
      <SharedTooltip containerRef={containerRef} model={model} />
    </div>
  )
})

export default HierarchicalTree
