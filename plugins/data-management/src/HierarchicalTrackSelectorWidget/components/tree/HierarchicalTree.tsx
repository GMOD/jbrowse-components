import { useState } from 'react'

import { observer } from 'mobx-react'

import TreeItem from './TreeItem'

import type { HierarchicalTrackSelectorModel } from '../../model'

const HierarchicalTree = observer(function ({
  height,
  model,
}: {
  height: number
  model: HierarchicalTrackSelectorModel
}) {
  const { flattenedItems } = model
  const [scrollTop, setScrollTop] = useState(0)
  const { startIndex, endIndex, totalHeight, itemOffsets } = model.itemOffsets(
    height,
    scrollTop,
  )

  return (
    <div
      style={{
        height,
        overflowY: 'auto',
        contain: 'strict',
      }}
      onScroll={e => {
        setScrollTop((e.target as HTMLElement).scrollTop)
      }}
    >
      <div
        style={{
          height: totalHeight,
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
              top={itemOffsets[index]!}
            />
          ) : null
        })}
      </div>
    </div>
  )
})

export default HierarchicalTree
