import { makeSessionDefaultControl } from '@jbrowse/core/configuration'
import { promotableRadioItem } from '@jbrowse/core/ui'

import { getHeightModeOptions } from './heightMode.ts'

import type { HeightMode } from './heightMode.ts'
import type { PromotableDisplay } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// The minimal display surface the "Track height" radio group drives: the
// resolved mode (for the radio's `checked`), the setter (for `onClick`), and the
// promotable-slot plumbing `makeSessionDefaultControl` needs for the pin.
export type HeightModeMenuModel = PromotableDisplay & {
  heightMode: HeightMode
  setHeightMode: (mode: HeightMode) => void
}

// The "Track height" radio group (fixed/grow/fit), built identically for every
// display that exposes the `heightMode` slot: each radio selects the mode for
// this track, its pin promotes that mode as the session-wide default. Sharing
// the whole builder — not just the labels — makes the canvas and alignments
// menus identical by construction rather than by two call sites that happen to
// agree. `noun` names what the track holds ('features', 'reads').
export function heightModeMenuItems(
  model: HeightModeMenuModel,
  noun: string,
): MenuItem[] {
  return getHeightModeOptions(noun).map(option =>
    promotableRadioItem({
      label: option.label,
      checked: model.heightMode === option.value,
      onClick: () => {
        model.setHeightMode(option.value)
      },
      sessionDefault: makeSessionDefaultControl(
        model,
        'heightMode',
        option.value,
      ),
    }),
  )
}
