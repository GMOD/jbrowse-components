import { useEffect } from 'react'

import { createScrollLatch, normalizeWheelDeltaY } from '@jbrowse/core/util'
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
//
// 1. model → DOM via autorun (catches programmatic resets like
// clearDisplaySpecificData). The React effect cleanup disposes the autorun;
// MST destruction is always preceded by React unmount in practice (the
// containing view unmounts the display before MST teardown).
//
// 2. DOM → model via a rAF-coalesced scroll listener.
//
// The wheel listener also rescues Chrome's shift+wheel behavior: with
// overflowX:hidden Chrome drops the remapped horizontal scroll (and can fire
// overscroll back-navigation), so we do the vertical scroll ourselves.
export function useScrollSync(
  containerRef: React.RefObject<HTMLDivElement | null>,
  model: ScrollSyncModel,
  view: ScrollSyncView,
) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    return autorun(() => {
      const target = model.scrollTop
      if (el.scrollTop !== target) {
        el.scrollTop = target
      }
    })
  }, [containerRef, model])

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

    const latch = createScrollLatch()
    const handleWheel = (e: WheelEvent) => {
      if (!model.hasOverflow || e.ctrlKey || e.metaKey) {
        return
      }
      if (e.shiftKey) {
        const max = container.scrollHeight - container.clientHeight
        const dy = normalizeWheelDeltaY(e.deltaY, e.deltaMode, container.clientHeight)
        const next = latch.scroll(e, container.scrollTop, dy, max)
        if (next !== null) {
          e.stopPropagation()
          container.scrollTop = next
        }
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
