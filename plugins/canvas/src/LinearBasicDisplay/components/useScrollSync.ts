import { useEffect } from 'react'

import { createScrollLatch, normalizeWheelDelta } from '@jbrowse/core/util'
import { useScrollTopSync } from '@jbrowse/core/util/useScrollTopSync'

interface ScrollSyncModel {
  scrollTop: number
  hasOverflow: boolean
  setScrollTop: (top: number) => void
}

interface ScrollSyncView {
  scrollZoom: boolean
}

// model.scrollTop <-> DOM container two-way sync (useScrollTopSync) plus this
// display's wheel handling. The wheel listener rescues Chrome's shift+wheel
// behavior: with overflowX:hidden Chrome drops the remapped horizontal scroll
// (and can fire overscroll back-navigation), so we do the vertical scroll
// ourselves.
export function useScrollSync(
  containerRef: React.RefObject<HTMLDivElement | null>,
  model: ScrollSyncModel,
  view: ScrollSyncView,
) {
  useScrollTopSync(containerRef, model)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const latch = createScrollLatch()
    const handleWheel = (e: WheelEvent) => {
      if (!model.hasOverflow || e.ctrlKey || e.metaKey) {
        return
      }
      if (e.shiftKey) {
        const max = container.scrollHeight - container.clientHeight
        const dy = normalizeWheelDelta(
          e.deltaY,
          e.deltaMode,
          container.clientHeight,
        )
        const next = latch.scroll(e, container.scrollTop, dy, max)
        if (next !== null) {
          e.stopPropagation()
          container.scrollTop = next
        }
      } else if (view.scrollZoom) {
        e.preventDefault()
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef, model, view])
}
