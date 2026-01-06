import { useEffect, useRef, useState } from 'react'

import { observer } from 'mobx-react'

import TreeItem from './TreeItem.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const HierarchicalTree = observer(function HierarchicalTree({
  height,
  model,
}: {
  height: number
  model: HierarchicalTrackSelectorModel
}) {
  const { flattenedItems, shownTrackIds } = model
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const { startIndex, endIndex, totalHeight, itemOffsets } = model.itemOffsets(
    height,
    scrollTop,
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const onScroll = () => {
      const newScrollTop = container.scrollTop
      setScrollTop(prev => {
        // avoid re-render if scroll position hasn't changed enough to affect visible items
        const { startIndex: prevStart, endIndex: prevEnd } = model.itemOffsets(
          height,
          prev,
        )
        const { startIndex: nextStart, endIndex: nextEnd } = model.itemOffsets(
          height,
          newScrollTop,
        )
        if (prevStart === nextStart && prevEnd === nextEnd) {
          return prev
        }
        return newScrollTop
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
    }
  }, [height, model])

  return (
    <div
      ref={containerRef}
      style={{
        height,
        overflowY: 'auto',
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
              checked={
                item.type === 'track'
                  ? shownTrackIds.has(item.trackId)
                  : undefined
              }
            />
          ) : null
        })}
      </div>
    </div>
  )
})

export default HierarchicalTree
