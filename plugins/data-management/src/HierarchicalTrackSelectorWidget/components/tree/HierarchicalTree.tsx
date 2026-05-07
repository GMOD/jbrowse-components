import { useEffect, useRef, useState } from 'react'

const noRange = { startIndex: -1, endIndex: -1 }

import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import SharedTooltip from './SharedTooltip.tsx'
import TreeItem from './TreeItem.tsx'
import { useSearchHighlight } from '../../../useSearchHighlight.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const HierarchicalTree = observer(function HierarchicalTree({
  height,
  model,
}: {
  height: number
  model: HierarchicalTrackSelectorModel
}) {
  const { flattenedItems } = model
  const { drawerPosition } = getSession(model)
  const containerRef = useRef<HTMLDivElement>(null)
  const visibleRangeRef = useRef(noRange)
  const [scrollTop, setScrollTop] = useState(0)
  useSearchHighlight(
    containerRef,
    model.filterText,
    'jbrowse-hierarchical-search',
  )
  const { startIndex, endIndex, totalHeight, itemOffsets } = model.itemOffsets(
    height,
    scrollTop,
  )
  visibleRangeRef.current = { startIndex, endIndex }

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let rafId: number | undefined
    const onScroll = () => {
      if (rafId !== undefined) {
        return
      }
      rafId = requestAnimationFrame(() => {
        rafId = undefined
        const newScrollTop = container.scrollTop
        const { startIndex, endIndex } = model.itemOffsets(height, newScrollTop)
        const prev = visibleRangeRef.current
        if (startIndex !== prev.startIndex || endIndex !== prev.endIndex) {
          visibleRangeRef.current = { startIndex, endIndex }
          setScrollTop(newScrollTop)
        }
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId)
      }
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
            />
          ) : null
        })}
      </div>
      <SharedTooltip
        containerRef={containerRef}
        placement={drawerPosition === 'left' ? 'right' : 'left'}
      />
    </div>
  )
})

export default HierarchicalTree
