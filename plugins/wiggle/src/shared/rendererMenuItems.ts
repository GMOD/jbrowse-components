import {
  type ScoreScaleModel,
  makeCrossHatchItem,
  makeScoreSubMenu,
} from '@jbrowse/wiggle-core'

import type { MenuItem } from '@jbrowse/core/ui'

interface MenuSelf extends ScoreScaleModel {
  displayCrossHatches: boolean
  toggleCrossHatches: () => void
}

// Cross-display menu items: the shared Score submenu (scale + autoscale +
// min/max) and the cross hatches toggle. Both LinearWiggleDisplay (bars) and
// LinearManhattanDisplay (GWAS points) compose these into their own
// trackMenuItems. Wiggle's bar-only items (rendering type, summary score
// mode) stay in LinearWiggleDisplay/model.ts and are injected here via
// `leadingItems`/`scaleType` if needed.
export function rendererMenuItems(
  self: MenuSelf,
  opts: { leadingItems?: MenuItem[]; scaleType?: boolean } = {},
) {
  // scaleType defaults off: manhattan is linear-only (pre-transformed -log10 p
  // values). LinearWiggleDisplay opts in with `{ scaleType: true }`.
  const { leadingItems, scaleType = false } = opts
  return [
    makeScoreSubMenu(self, { leadingItems, scaleType }),
    makeCrossHatchItem(self),
  ]
}
