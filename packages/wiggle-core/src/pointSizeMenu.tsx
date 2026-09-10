import { getSlotDefinition } from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'

import type {
  ConfigModelForFields,
  ResolvableDisplay,
} from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// Wires a display's shared `scatterPointSize`/`setScatterPointSize` (from
// WiggleScoreConfigMixin) to makeSizeMenu. Used by both the wiggle scatter and
// GWAS Manhattan track menus so the slider/reset behavior can't drift.
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
  return makeSizeMenu({
    label: opts.label,
    title: 'Point size',
    getValue: () => self.scatterPointSize,
    isDefault:
      self.scatterPointSize ===
      getSlotDefinition(self.configuration, 'scatterPointSize').defaultValue,
    onChange: n => {
      self.setScatterPointSize(n)
    },
    onReset: () => {
      self.setScatterPointSize(undefined)
    },
  })
}
