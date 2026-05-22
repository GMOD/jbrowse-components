import { useEffect } from 'react'

import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

interface ScrollSyncModel extends IAnyStateTreeNode {
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
// clearDisplaySpecificData). Registered with addDisposer so MST teardown
// disposes the autorun even if the React unmount hasn't fired yet.
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
    const dispose = autorun(() => {
      const target = model.scrollTop
      if (el.scrollTop !== target) {
        el.scrollTop = target
      }
    })
    addDisposer(model, dispose)
    return dispose
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
