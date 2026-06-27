import { useEffect } from 'react'
import type React from 'react'

import { useScrollTopSync } from '@jbrowse/core/util/useScrollTopSync'

import { applyRowResizeWheel } from './applyRowResizeWheel.ts'

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
// model.scrollTop <-> DOM via useScrollTopSync; the wheel handler keeps the
// variant-specific gesture from ADR-027: shift = change row height (a zoom-like
// gesture), plain wheel = native scroll when zoom is off, and preventDefault
// under scrollZoom so the view zooms rather than the panel scrolling.
export function useVariantNativeScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  model: VariantScrollModel,
  view: VariantScrollView,
) {
  useScrollTopSync(containerRef, model)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        return
      }
      if (e.shiftKey) {
        // shift = resize rows under the cursor (works whether or not the rows
        // currently overflow, so you can grow them out of the fit state)
        applyRowResizeWheel(e, container, {
          rowHeight: model.rowHeight,
          scrollTop: model.scrollTop,
          nrow: model.nrow,
          viewportHeight: model.availableHeight,
          setRowHeight: model.setRowHeight,
          setScrollTop: model.setScrollTop,
        })
      } else if (model.hasOverflow && view.scrollZoom) {
        // suppress native scroll so the view's wheel handler zooms instead;
        // without scrollZoom the container scrolls natively (no preventDefault)
        e.preventDefault()
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef, model, view])
}
