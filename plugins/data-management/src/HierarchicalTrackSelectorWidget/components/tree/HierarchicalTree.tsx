import { type RefObject, useEffect, useRef, useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import SharedTooltip from './SharedTooltip.tsx'
import TreeItem from './TreeItem.tsx'
import { useSearchHighlight } from '../../../useSearchHighlight.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

interface Range {
  startIndex: number
  endIndex: number
  totalHeight: number
  itemOffsets: number[]
}

// Subscribes to container scroll + MST offset changes and exposes the current
// visible range; only re-renders when start/end actually change.
function useVisibleRange(
  containerRef: RefObject<HTMLDivElement | null>,
  model: HierarchicalTrackSelectorModel,
  height: number,
): Range {
  const [range, setRange] = useState(() => model.itemOffsets(height, 0))
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    let rafId: number | undefined
    const recompute = () => {
      rafId = undefined
      const next = model.itemOffsets(height, container.scrollTop)
      setRange(prev =>
        next.startIndex === prev.startIndex &&
        next.endIndex === prev.endIndex &&
        next.totalHeight === prev.totalHeight
          ? prev
          : next,
      )
    }
    const onScroll = () => {
      rafId ??= requestAnimationFrame(recompute)
    }
    const dispose = autorun(() => {
      void model.flattenedItemOffsets
      recompute()
    })
    addDisposer(model, dispose)
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      dispose()
      container.removeEventListener('scroll', onScroll)
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [containerRef, model, height])
  return range
}

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
  useSearchHighlight(
    containerRef,
    model.filterText,
    'jbrowse-hierarchical-search',
  )
  const { startIndex, endIndex, totalHeight, itemOffsets } = useVisibleRange(
    containerRef,
    model,
    height,
  )

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
