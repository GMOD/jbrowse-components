import { useEffect } from 'react'

import { autorun } from 'mobx'

interface ScrollSyncModel {
  scrollTop: number
  hasOverflow: boolean
  setScrollTop: (top: number) => void
}

interface ScrollSyncView {
  scrollZoom: boolean
}

// Two-way scroll sync between model.scrollTop (MST) and the DOM container.
// model → DOM via autorun (catches programmatic resets like
// clearDisplaySpecificData). DOM → model via a rAF-coalesced scroll listener.
// The wheel listener also rescues Chrome's shift+wheel behavior: with
// overflowX:hidden Chrome drops the remapped horizontal scroll (and can fire
// overscroll back-navigation), so we do the vertical scroll ourselves.
export function useScrollSync(
  containerRef: React.RefObject<HTMLDivElement | null>,
  model: ScrollSyncModel,
  view: ScrollSyncView,
) {
  useEffect(
    () =>
      autorun(() => {
        const target = model.scrollTop
        const container = containerRef.current
        if (container && container.scrollTop !== target) {
          container.scrollTop = target
        }
      }),
    [containerRef, model],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let rafId = 0
    const scheduleSync = () => {
      if (rafId === 0) {
        rafId = requestAnimationFrame(() => {
          rafId = 0
          model.setScrollTop(container.scrollTop)
        })
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (!model.hasOverflow) {
        return
      }
      if (e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        container.scrollTop += e.deltaY
      } else if (view.scrollZoom) {
        e.preventDefault()
      }
    }

    container.addEventListener('scroll', scheduleSync, { passive: true })
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('scroll', scheduleSync)
      container.removeEventListener('wheel', handleWheel)
      if (rafId !== 0) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [containerRef, model, view])
}
