import { checkboxItem, radioItem, radioItems } from './toggleMenuItems.ts'

import type { Pin } from '../configuration/promotableDefaults.ts'
import type { CheckboxMenuItem, RadioMenuItem } from './MenuTypes.ts'
import type { RadioOption, SettingRowOptions } from './toggleMenuItems.ts'

// Every builder here describes the trailing pin (`pin`) rather than
// rendering it. That is what keeps this module — and therefore every state
// model and menu file that calls it — free of React and of MUI's
// ToggleButton/Tooltip. `menuItemAdornment.tsx` turns the description into
// `PinAdornment` at the point the menu is drawn. See
// reference/EAGER_BUNDLE.md; `menuItems.purity.test.ts` holds it.
//
// Each is the plain builder in `toggleMenuItems.ts` plus a pin, and each is
// written that way — `checkboxItem` / `radioItems` build the row — so the
// promotable and plain forms of a row can differ only by the pin.

// A promotable setting as one native checkbox menu row: the value toggles the
// track (inheriting native hover/sizing/keyboard), and a trailing pin
// (endAdornment) sets/clears this value as the display type's default. Always
// shown so the capability is discoverable.
//
// **The row itself is `checkboxItem`'s**, so the two builders can only ever
// differ by the pin. They used to be two literals, and had already drifted: this
// one accepted `helpText` and `keepMenuOpen` while silently dropping `disabled`
// and `disabledHelpText`, so a promotable row could not be greyed out the way
// its plain sibling could. Sharing the body is also what makes a future
// change to what a checkbox row *is* reach both — the failure `checkboxItem`'s
// own comment records is a menu regressing by omission.
//
// `keepMenuOpen` is left unset by default, so `CascadingMenu` keeps the row open
// by its checkbox type: these rows only write a setting, users flip several in
// one visit, and the menu is an observer so the ticks and pins move live. A row
// whose click opens a dialog instead (colorBy's "Tag...") passes false.
/** #menuBuilder promotableToggleItem | `checkboxItem` plus a promote-to-default pin */
export function promotableToggleItem({
  label,
  checked,
  onToggle,
  pin,
  ...opts
}: {
  label: string
  checked: boolean
  onToggle: () => void
  pin: Pin
} & SettingRowOptions): CheckboxMenuItem {
  return {
    ...checkboxItem(label, checked, onToggle, opts),
    pin: { control: pin, label },
  }
}

// ONE radio row of a promotable-value group — the escape hatch, for a group the
// plural builder below can't express. **Reach for `promotableRadioItems` first**:
// every option in a group has to get a pin, and hand-naming the rows is what
// leaves one without.
//
// The rows that genuinely need this: `pin` is optional here, for a row with no
// single value to promote yet (the colorBy "Tag..." row before a tag is picked)
// or a display whose slot isn't promotable at all (the shared colorBy menu on
// gwas/variants); and the alignments size presets, whose group is gated row by
// row (`needsContent`) and mixes in a non-promotable "Custom..." peer.
//
// **The row itself is `radioItem`'s**, for the reason `promotableToggleItem`'s
// is `checkboxItem`'s: it was a second literal, and it had drifted the same way
// its checkbox sibling had — naming `helpText`/`keepMenuOpen` by hand and so
// silently dropping `disabled` and `disabledHelpText`, which the
// alignments size presets have to bolt back on afterwards (`needsContent`).
/** #menuBuilder promotableRadioItem | `radioItem` plus a promote-to-default pin */
export function promotableRadioItem({
  label,
  checked,
  onClick,
  pin,
  ...opts
}: {
  label: string
  checked: boolean
  onClick: () => void
  pin?: Pin
} & SettingRowOptions): RadioMenuItem {
  return {
    ...radioItem(label, checked, onClick, opts),
    ...(pin && {
      pin: { control: pin, label },
    }),
  }
}

// A whole promotable radio group: `radioItems` plus one pin per option. The
// plural form of the builder above, and the one to reach for on a group whose
// options differ only in their value — which is all four of them today
// (`heightMode`, `displayMode`, `subfeatureLabels`, `sashimiArcsMode`).
//
// **Every option in a group gets a pin, the `promotedBase` value included** —
// once a non-base value is promoted, pinning the base back is the only per-value
// way to undo it from its own row, and a radio group with one row silently
// missing its trailing control reads as a bug. Building the group here is what
// makes that structural instead of a rule to remember: `sashimiArcsMode`'s base
// looked unpinnable precisely because each row had been named by hand. Prefer
// this over `.map(promotableRadioItem)` whenever the pin is a function of the
// option's value.
//
// `pin` is a factory rather than an array so it can't be a row short. Pass
// `value => makePin(self, slot, value)`, or a model member of that shape where
// the menu module is handed a duck-typed model (alignments).
//
// The rows are `radioItems`' own, so the promotable and plain groups can't drift
// on anything but the pin. `radioItems` maps `options` in order, which is what
// lets each row be paired back to the option that built it.
/** #menuBuilder promotableRadioItems | `radioItems` plus a pin per option, from a factory over the value */
export function promotableRadioItems<T extends string>(
  options: readonly RadioOption<T>[],
  current: T | undefined,
  setMode: (m: T) => void,
  pin: (value: T) => Pin,
): RadioMenuItem[] {
  return radioItems(options, current, setMode).map((item, i) => {
    const { value, label } = options[i]!
    return { ...item, pin: { control: pin(value), label } }
  })
}
