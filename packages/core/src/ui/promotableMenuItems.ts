import type { Pin } from '../configuration/promotableDefaults.ts'
import type { CheckboxMenuItem, RadioMenuItem } from './MenuTypes.ts'

// Both builders describe the trailing pin (`pin`) rather than
// rendering it. That is what keeps this module — and therefore every state
// model and menu file that calls it — free of React and of MUI's
// ToggleButton/Tooltip. `menuItemAdornment.tsx` turns the description into
// `PinAdornment` at the point the menu is drawn. See
// reference/EAGER_BUNDLE.md; `menuItems.purity.test.ts` holds it.

// A promotable setting as one native checkbox menu row: the value toggles the
// track (inheriting native hover/sizing/keyboard), and a trailing pin
// (endAdornment) sets/clears this value as the display type's default. Always
// shown so the capability is discoverable.
//
// `keepMenuOpen` is passed through unset, so `CascadingMenu` keeps the row open
// by its checkbox type: these rows only write a setting, users flip several in
// one visit, and the menu is an observer so the ticks and pins move live. A row
// whose click opens a dialog instead (colorBy's "Tag...") passes false.
export function promotableToggleItem({
  label,
  helpText,
  checked,
  onToggle,
  pin,
  keepMenuOpen,
}: {
  label: string
  helpText?: string
  checked: boolean
  onToggle: () => void
  pin: Pin
  keepMenuOpen?: boolean
}): CheckboxMenuItem {
  return {
    label,
    helpText,
    type: 'checkbox',
    checked,
    keepMenuOpen,
    onClick: () => {
      onToggle()
    },
    pin: { control: pin, label },
  }
}

// A radio row in a promotable-value group (e.g. one option of a multi-value enum
// slot). EVERY option in a group gets a pin, the `promotedBase` value included:
// once a non-base value is promoted, pinning the base back is the only per-value
// way to undo it from its own row, and a radio group with one row silently
// missing its trailing control reads as a bug. `pin` stays
// optional only for a row that has no single value to promote yet (the colorBy
// "Tag..." row before a tag is picked) or a display whose slot isn't promotable
// at all (the shared colorBy menu on gwas/variants). `keepMenuOpen` is passed
// through as in `promotableToggleItem`.
export function promotableRadioItem({
  label,
  subLabel,
  helpText,
  checked,
  onClick,
  pin,
  keepMenuOpen,
}: {
  label: string
  subLabel?: string
  helpText?: string
  checked: boolean
  onClick: () => void
  pin?: Pin
  keepMenuOpen?: boolean
}): RadioMenuItem {
  return {
    label,
    subLabel,
    helpText,
    type: 'radio',
    checked,
    onClick,
    keepMenuOpen,
    ...(pin && {
      pin: { control: pin, label },
    }),
  }
}
