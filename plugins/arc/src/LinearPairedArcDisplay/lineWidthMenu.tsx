import { makePromotableSizeMenu } from '@jbrowse/core/ui'

import type { LinearPairedArcDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Arc stroke width is a pure repaint (main-thread canvas, no RPC worker), so the
// shared size slider commits live on `onChange` rather than on release.
export function makeLineWidthMenuItem(
  self: LinearPairedArcDisplayModel,
): MenuItem {
  return makePromotableSizeMenu({
    label: 'Arc width',
    title: 'Arc width',
    min: 1,
    max: 20,
    step: 1,
    display: self,
    slot: 'lineWidth',
    getValue: () => self.lineWidth,
    onChange: n => {
      self.setLineWidth(n)
    },
    onReset: () => {
      self.setLineWidth(undefined)
    },
  })
}
