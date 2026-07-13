import { makeCurrentValueDisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'

import type { PromotableDisplay } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

export { makeSizeMenu }

// Wires a display's shared `scatterPointSize`/`setScatterPointSize` (from
// WiggleScoreConfigMixin) to makeSizeMenu. Used by both the wiggle scatter and
// GWAS Manhattan track menus so the slider/reset/pin behavior can't drift. The
// `scatterPointSize` slot is promotable, so the row carries the "default for all
// tracks of this type" pin.
export function makeScatterPointSizeMenuItem(
  self: {
    scatterPointSize: number
    setScatterPointSize: (n?: number) => void
  } & PromotableDisplay,
  opts: { label: string; defaultValue: number },
): MenuItem {
  return makeSizeMenu({
    label: opts.label,
    title: 'Point size',
    getValue: () => self.scatterPointSize,
    isDefault: self.scatterPointSize === opts.defaultValue,
    onChange: n => {
      self.setScatterPointSize(n)
    },
    onReset: () => {
      self.setScatterPointSize(undefined)
    },
    displayTypeDefault: makeCurrentValueDisplayTypeDefaultControl(self, [
      'scatterPointSize',
    ]),
  })
}
