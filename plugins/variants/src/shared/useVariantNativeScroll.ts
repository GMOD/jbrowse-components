import { useEffect } from 'react'
import type React from 'react'

import { autorun } from 'mobx'

interface VariantScrollModel {
  scrollTop: number
  hasOverflow: boolean
  rowHeight: number
  nrow: number
  availableHeight: number
  setScrollTop: (n: number) => void
  setRowHeight: (n: number) => void
}

interface VariantScrollView {
  scrollZoom: boolean
}

// Native vertical scroll for the plain multi-sample variant display, which has
// no pinned top band and so scrolls its whole row area as one block — the same
// sticky-canvas + native-overflow pattern the canvas feature display uses
// (useScrollSync.ts). The matrix display keeps a custom VerticalScrollbar
// because its connecting-lines zone is pinned above the rows.
//
// 1. model.scrollTop -> DOM via autorun (catches programmatic resets like
//    clearDisplaySpecificData). 2. DOM -> model via a rAF-coalesced scroll
//    listener. The wheel handler keeps the variant-specific gesture from
//    ADR-027: shift = change row height (a zoom-like gesture), plain wheel =
//    native scroll when zoom is off, and preventDefault under scrollZoom so the
//    view zooms rather than the panel scrolling.
export function useVariantNativeScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  model: VariantScrollModel,
  view: VariantScrollView,
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

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        return
      }
      if (e.shiftKey) {
        // shift = resize rows under the cursor (works whether or not the rows
        // currently overflow, so you can grow them out of the fit state)
        e.preventDefault()
        const delta = e.deltaY > 0 ? -1 : 1
        const minRowHeight = model.availableHeight / model.nrow
        const newRowHeight = Math.min(
          20,
          Math.max(minRowHeight, model.rowHeight + delta),
        )
        const rect = container.getBoundingClientRect()
        const mouseY = e.clientY - rect.top
        const rowUnderMouse = (mouseY + model.scrollTop) / model.rowHeight
        model.setRowHeight(newRowHeight)
        model.setScrollTop(Math.max(0, rowUnderMouse * newRowHeight - mouseY))
      } else if (model.hasOverflow && view.scrollZoom) {
        // suppress native scroll so the view's wheel handler zooms instead;
        // without scrollZoom the container scrolls natively (no preventDefault)
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
