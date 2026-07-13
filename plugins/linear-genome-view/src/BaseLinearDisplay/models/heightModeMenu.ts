import { makeDisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import { promotableRadioItem } from '@jbrowse/core/ui'
import AspectRatioIcon from '@mui/icons-material/AspectRatio'

import { getHeightModeOptions } from './heightMode.ts'

import type { HeightMode } from './heightMode.ts'
import type { PromotableDisplay } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// The minimal display surface the "Track sizing" radio group drives: the
// resolved mode (for the radio's `checked`), the setter (for `onClick`), and the
// promotable-slot plumbing `makeDisplayTypeDefaultControl` needs for the pin.
export type HeightModeMenuModel = PromotableDisplay & {
  heightMode: HeightMode
  setHeightMode: (mode: HeightMode) => void
}

// The "Track sizing" radio group (fixed/grow/fit), built identically for every
// display that exposes the `heightMode` slot: each radio selects the mode for
// this track, its pin promotes that mode as the session-wide default. Sharing
// the whole builder — not just the labels — makes the canvas and alignments
// menus identical by construction rather than by two call sites that happen to
// agree. `noun` is the singular of what the track holds ('feature', 'read').
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
      displayTypeDefault: makeDisplayTypeDefaultControl(
        model,
        'heightMode',
        option.value,
      ),
    }),
  )
}

// The whole "Track sizing" submenu entry, so the canvas and alignments track
// menus render an identical item (label, icon, radios) by construction. It sits
// as a SIBLING of the per-feature "Read height" / "Feature height" size menu —
// the two halves of the diametric split: this entry is how the TRACK responds
// to more content than fits (fixed / autogrow / fit-to-display), the size menu
// is how tall each feature is drawn.
export function getTrackSizingMenuItem(
  model: HeightModeMenuModel,
  noun: string,
  opts?: { disabled?: boolean; disabledHelpText?: string },
): MenuItem {
  return {
    label: 'Track sizing',
    icon: AspectRatioIcon,
    disabled: opts?.disabled,
    disabledHelpText: opts?.disabledHelpText,
    subMenu: heightModeMenuItems(model, noun),
  }
}
