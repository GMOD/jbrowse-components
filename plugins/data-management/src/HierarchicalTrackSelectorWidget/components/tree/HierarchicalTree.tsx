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
  const { flattenedItems } = model
  const { offsets, cumulativeHeight } = model.flattenedItemOffsets
  // clamp: when the list shrinks (filter/collapse) the browser caps the real
  // scrollTop but may not fire a scroll event, leaving our state stale-high and
  // rendering a blank viewport until the next manual scroll
  const effectiveScrollTop = Math.min(
    scrollTop,
    Math.max(0, cumulativeHeight - height),
  )
  const { startIndex, endIndex } = model.itemOffsets(height, effectiveScrollTop)

  return (
    <div
      ref={containerRef}
      style={{ height, overflowY: 'auto' }}
      onScroll={e => {
        setScrollTop(e.currentTarget.scrollTop)
      }}
    >
      <div
        style={{
          height: cumulativeHeight,
          width: '100%',
          position: 'relative',
        }}
      >
        {Array.from({ length: endIndex - startIndex + 1 }, (_, i) => {
          const index = startIndex + i
          const item = flattenedItems[index]
          return item ? (
            <TreeItem
              key={item.id}
              model={model}
              item={item}
              top={offsets[index]!}
            />
          ) : null
        })}
      </div>
      <SharedTooltip containerRef={containerRef} model={model} />
    </div>
  )
})

export default HierarchicalTree
