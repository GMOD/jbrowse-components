import { makePin } from '@jbrowse/core/configuration'
import { promotableRadioItem } from '@jbrowse/core/ui/menuItems'

import { getHeightModeOptions } from './heightMode.ts'

import type { HeightMode } from './heightMode.ts'
import type { ResolvableDisplay } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// The minimal display surface the "Track sizing" radio group drives: the
// resolved mode (for the radio's `checked`), the setter (for `onClick`), and the
// promotable-slot plumbing `makePin` needs for the pin.
export type HeightModeMenuModel = ResolvableDisplay & {
  heightMode: HeightMode
  setHeightMode: (mode: HeightMode) => void
}

// The "Track sizing" radio group (fixed/grow/fit), built identically for every
// display that exposes the `heightMode` slot: each radio selects the mode for
// this track, its pin promotes that mode as the session-wide default. Sharing
// the whole builder — not just the labels — makes the canvas and alignments
// menus identical by construction rather than by two call sites that happen to
// agree. `noun` is the singular of what the track holds ('feature', 'read').
//
// Callers render these under a "Track sizing" subHeader inside the per-feature
// size menu ("Feature height" / "Read height"), so one menu holds both halves
// of the diametric split: the size radios are how tall each feature is drawn,
// these are how the TRACK responds to more content than fits.
export function heightModeMenuItems(
  model: HeightModeMenuModel,
  noun: string,
): MenuItem[] {
  return getHeightModeOptions(noun).map(option =>
    promotableRadioItem({
      label: option.label,
      checked: model.heightMode === option.value,
      // Like every other radio that only writes a setting. These render
      // directly below the size presets, which already keep the menu open, so
      // dismissing here made one submenu behave two ways.
      onClick: () => {
        model.setHeightMode(option.value)
      },
      pin: makePin(model, 'heightMode', option.value),
    }),
  )
}
