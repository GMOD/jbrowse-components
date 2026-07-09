import { getContainingView } from '@jbrowse/core/util'
import { useVirtualScrollWheel } from '@jbrowse/core/util/useVirtualScrollWheel'

import { applyRowResizeWheel } from './applyRowResizeWheel.ts'

import type { MultiSampleVariantBaseModel } from './MultiSampleVariantBaseModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Virtual-scroll wheel wiring shared by both multi-sample variant displays:
// plain wheel scrolls the rows, shift+wheel resizes them (a vertical-zoom
// gesture), and ctrl/meta/scroll-zoom gestures fall through to the view. All
// scroll geometry comes from the shared base model, so the two displays stay
// identical by construction.
export function useVariantVirtualScroll(
  canvas: HTMLCanvasElement | null,
  model: MultiSampleVariantBaseModel,
) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const scrollZoom = view.scrollZoom
  useVirtualScrollWheel(canvas, (e, applyScroll) => {
    if (e.shiftKey) {
      applyRowResizeWheel(e, canvas!, {
        rowHeight: model.effectiveRowHeight,
        scrollTop: model.scrollTop,
        nrow: model.nrow,
        viewportHeight: model.availableHeight,
        setRowHeight: n => {
          model.setRowHeight(n)
        },
        setScrollTop: n => {
          model.setScrollTop(n)
        },
      })
    } else if (!scrollZoom && !e.ctrlKey && !e.metaKey) {
      const next = applyScroll(e, {
        scrollTop: model.scrollTop,
        viewportHeight: model.availableHeight,
        scrollableHeight: model.scrollableHeight,
      })
      if (next !== null) {
        model.setScrollTop(next)
      }
    }
  })
}
