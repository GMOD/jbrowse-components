import { useRef, useState } from 'react'

import { observer } from 'mobx-react'

import SharedTooltip from './SharedTooltip.tsx'
import TreeItem from './TreeItem.tsx'
import { useSearchHighlight } from '../../../shared/useSearchHighlight.ts'

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
  useSearchHighlight(
    containerRef,
    model.filterText,
    'jbrowse-hierarchical-search',
  )
  const { flattenedItems } = model
  const { offsets, cumulativeHeight } = model.flattenedItemOffsets
  const { startIndex, endIndex } = model.itemOffsets(height, scrollTop)

  return (
    <div
      ref={containerRef}
      style={{ height, overflowY: 'auto' }}
      onScroll={(e) => {
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
