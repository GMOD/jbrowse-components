import { getContainingView } from '@jbrowse/core/util'
import { useRowVirtualScroll } from '@jbrowse/core/util/useRowVirtualScroll'

import type { MultiSampleVariantBaseModel } from './MultiSampleVariantBaseModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Row-stack wheel wiring for both multi-sample variant displays: plain wheel
// scrolls the rows, shift+wheel resizes them (a vertical-zoom gesture), and
// ctrl/meta/scroll-zoom gestures fall through to the view. The rule itself is
// `useRowVirtualScroll`, shared with MAF — see ADR-027 for why that one rule is
// unified while the pileup/canvas-basic rule is not. All that is display-
// specific is which height the rows lay out against, and that comes off the
// shared base model, so the two variant displays stay identical by construction.
export function useVariantVirtualScroll(
  el: HTMLElement | null,
  model: MultiSampleVariantBaseModel,
) {
  const view = getContainingView(model) as LinearGenomeViewModel
  useRowVirtualScroll(el, model, {
    viewportHeight: model.availableHeight,
    scrollZoom: view.scrollZoom,
  })
}
