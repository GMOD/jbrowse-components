import { makeCurrentValueDisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'

import { defaultArcLineWidth } from './configSchema.ts'

import type { LinearPairedArcDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Arc stroke width is a pure repaint (main-thread SVG, no RPC worker), so the
// shared makeSizeMenu slider commits live on `onChange` rather than on release.
export function makeLineWidthMenuItem(
  self: LinearPairedArcDisplayModel,
): MenuItem {
  return makeSizeMenu({
    label: 'Arc width',
    title: 'Arc width',
    min: 1,
    max: 20,
    step: 1,
    getValue: () => self.lineWidth,
    isDefault: self.lineWidth === defaultArcLineWidth,
    onChange: n => {
      self.setLineWidth(n)
    },
    onReset: () => {
      self.setLineWidth(undefined)
    },
    displayTypeDefault: makeCurrentValueDisplayTypeDefaultControl(self, [
      'lineWidth',
    ]),
  })
}
