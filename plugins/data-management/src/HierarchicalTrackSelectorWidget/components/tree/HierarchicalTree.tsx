import { type RefObject, useEffect, useRef, useState } from 'react'

import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import SharedTooltip from './SharedTooltip.tsx'
import TreeItem from './TreeItem.tsx'
import { useSearchHighlight } from '../../../shared/useSearchHighlight.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

// Subscribes to container scroll + MST offset changes and exposes the current
// visible range; only re-renders when start/end actually change.
function useVisibleRange(
  containerRef: RefObject<HTMLDivElement | null>,
  model: HierarchicalTrackSelectorModel,
  height: number,
) {
  const [range, setRange] = useState(() => model.itemOffsets(height, 0))
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    let rafId: number | undefined
    const applyRange = (next: ReturnType<typeof model.itemOffsets>) => {
      rafId = undefined
      setRange(prev =>
        next.startIndex === prev.startIndex &&
        next.endIndex === prev.endIndex &&
        next.totalHeight === prev.totalHeight
          ? prev
          : next,
      )
    }
    const onScroll = () => {
      rafId ??= requestAnimationFrame(() => {
        applyRange(model.itemOffsets(height, container.scrollTop))
      })
    }
    // addDisposer guards against the model being unmounted first; the React
    // cleanup handles the common case of unmounting while the model lives
    const dispose = autorun(() => {
      applyRange(model.itemOffsets(height, container.scrollTop))
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
      <SharedTooltip containerRef={containerRef} model={model} />
    </div>
  )
})

export default HierarchicalTree
