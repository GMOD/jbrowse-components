import { makePromotableSizeMenu } from '@jbrowse/core/ui'

import type {
  ConfigModelForFields,
  ResolvableDisplay,
} from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// Wires a display's shared `scatterPointSize`/`setScatterPointSize` (from
// WiggleScoreConfigMixin) to makePromotableSizeMenu. Used by both the wiggle
// scatter and GWAS Manhattan track menus so the slider/reset/pin behavior can't
// drift. The `scatterPointSize` slot is promotable, so the row carries the
// "default for all tracks of this type" pin.
export function makeScatterPointSizeMenuItem(
  self: {
    scatterPointSize: number
    setScatterPointSize: (n?: number) => void
  } & ResolvableDisplay<
    ConfigModelForFields<{
      scatterPointSize: { type: 'maybeNumber'; promotedBase: number }
    }>
  >,
  opts: { label: string },
): MenuItem {
  return makePromotableSizeMenu({
    label: opts.label,
    title: 'Point size',
    display: self,
    slot: 'scatterPointSize',
    getValue: () => self.scatterPointSize,
    onChange: n => {
      self.setScatterPointSize(n)
    },
    onReset: () => {
      self.setScatterPointSize(undefined)
    },
  })
}
