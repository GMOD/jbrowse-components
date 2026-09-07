import type { Pin } from '../configuration/promotablePin.ts'
import type { CheckboxMenuItem, MenuItem, RadioMenuItem } from './MenuTypes.ts'

// Neither helper sets `keepMenuOpen`: `CascadingMenu` keeps a checkbox/radio row
// open by its type (`staysOpenOnClick`), so a settings row states nothing and a
// hand-written literal behaves identically — which is what stops a new menu from
// regressing by omission, the way MAF's "Show..." menu did. The flag is left for
// the rows that genuinely dismiss (a dialog opener passes `keepMenuOpen: false`).
//
// A promotable row is the same row plus a `pin`, passed in the options bag.
// The pin is described here (`pin: { control, label }`) and drawn by
// `menuItemAdornment.tsx` when the menu opens, which is what keeps this module
// — and every state model and menu file that calls it — free of React and of
// MUI's ToggleButton/Tooltip (reference/EAGER_BUNDLE.md;
// `menuItems.purity.test.ts` holds it). There used to be a promotable twin of
// each builder here, and the twins drifted from the originals twice: one
// accepted `helpText` and `keepMenuOpen` while silently dropping `disabled`
// and `disabledHelpText`, so a promotable row could not be greyed out the way
// its plain sibling could.

// The row decorations no builder here decides for itself. `helpText` claims a
// "?" column that `getMenuColumnFlags` then reserves on EVERY row of the menu,
// so it is for real prose worth that cost. `subLabel` renders inline under the
// label and is NOT the answer to a short clarifier: a menu whose rows are each
// two lines tall is harder to scan than the labels it buried. Put a short
// clarifier in the label -- `withHint` for a conditional one.
// `keepMenuOpen: false` is for a settings row whose click opens a dialog.
export interface SettingRowOptions {
  helpText?: string
  disabled?: boolean
  disabledHelpText?: string
  keepMenuOpen?: boolean
}

// A row over a promotable slot carries the pin `makePin` built for the row's
// state; the builder names that state in the pin's label, which is what the
// tooltip and aria-label read. `pinLabel` replaces that derived label where it
// would under-describe the write — an unticked "Show read arcs" pin writes
// `readConnections: 'off'`, which switches the read cloud off as well.
export interface PinnableRowOptions extends SettingRowOptions {
  pin?: Pin
  pinLabel?: string
}

function withPin<T extends object>(
  row: T,
  pin: Pin | undefined,
  label: string,
) {
  return pin ? { ...row, pin: { control: pin, label } } : row
}

// The pin's label carries the checked state, since the row's label alone
// ("Show legend") does not say which state the pin applies.
/** #menuBuilder checkboxItem | one checkbox setting row, with a pin over its state when the setting is promotable */
export function checkboxItem(
  label: string,
  checked: boolean,
  onToggle: () => void,
  opts: PinnableRowOptions = {},
): CheckboxMenuItem {
  const { pin, pinLabel, ...rest } = opts
  return withPin(
    {
      label,
      type: 'checkbox' as const,
      checked,
      onClick: onToggle,
      ...rest,
    },
    pin,
    pinLabel ?? `${label}: ${checked ? 'on' : 'off'}`,
  )
}

/**
 * #menuBuilder toggleItem | a checkbox row whose setter takes the new value
 *
 * `checkboxItem` where the callback is handed the value rather than left to
 * derive it. Prefer this: the derivation is `!` applied to the same expression
 * the row is `checked` by, and writing it out per row is 38 chances to negate
 * the wrong thing — which fails as a checkbox that ticks and does nothing, with
 * nothing thrown.
 *
 * It is also the shape `radioItems` already takes (`setMode: (m: T) => void`),
 * so the two group builders now agree about who computes the new value.
 *
 * MAF had this as a local wrapper, and it had already lost most of
 * `SettingRowOptions` to a hand-narrowed one-field bag — the exact drift the
 * comment on that interface warns about.
 */
export function toggleItem(
  label: string,
  value: boolean,
  setValue: (value: boolean) => void,
  opts?: PinnableRowOptions,
): CheckboxMenuItem {
  return checkboxItem(
    label,
    value,
    () => {
      setValue(!value)
    },
    opts,
  )
}

// One radio row. The singular of `radioItems`, for a group the plural form
// can't express: a row with no single value to promote yet (the colorBy
// "Tag..." row before a tag is picked), a display whose slot isn't promotable
// at all (the shared colorBy menu on gwas/variants), or a group gated row by
// row and mixing in a non-promotable peer (the alignments size presets and
// their "Custom..." row). **Reach for `radioItems` first**: every option in a
// group has to get a pin, and hand-naming the rows is what leaves one without.
/** #menuBuilder radioItem | one radio setting row; the singular of `radioItems` */
export function radioItem(
  label: string,
  checked: boolean,
  onClick: () => void,
  opts: PinnableRowOptions = {},
): RadioMenuItem {
  const { pin, pinLabel, ...rest } = opts
  return withPin(
    {
      label,
      type: 'radio' as const,
      checked,
      onClick,
      ...rest,
    },
    pin,
    pinLabel ?? label,
  )
}

// One option of a radio group. Extends `SettingRowOptions` rather than
// restating it — it had hand-narrowed to two of the four, so no group could be
// gated row by row.
export interface RadioOption<T extends string> extends SettingRowOptions {
  value: T
  label: string
}

// `pin` is a factory rather than a per-option field so a promotable group can't
// be a row short. **Every option in a group gets a pin, the `promotedBase`
// value included**: once a non-base value is promoted, taking the base row's
// offer is the per-value way to undo it, and a radio group with one row silently
// missing its trailing control reads as a bug. `sashimiArcsMode`'s base looked
// unpinnable precisely because each row had been named by hand. Pass
// `value => makePin(self, slot, value)`, or a model member of that shape where
// the menu module is handed a duck-typed model (alignments).
/** #menuBuilder radioItems | a radio group, one row per option, with a pin per option when the setting is promotable */
export function radioItems<T extends string>(
  options: readonly RadioOption<T>[],
  current: T | undefined,
  setMode: (m: T) => void,
  pin?: (value: T) => Pin,
): RadioMenuItem[] {
  return options.map(({ value, label, ...opts }) =>
    radioItem(
      label,
      current === value,
      () => {
        setMode(value)
      },
      { ...opts, pin: pin?.(value) },
    ),
  )
}

/**
 * #menuBuilder withSubHeader | a section heading, present only if the section is
 *
 * Derived from the rows rather than from whatever gated them, so a heading
 * cannot outlive its section — the rows are usually gated on data, and an empty
 * section renders its heading directly above the next one's.
 */
export function withSubHeader(label: string, rows: MenuItem[]): MenuItem[] {
  return rows.length > 0 ? [{ type: 'subHeader', label }, ...rows] : []
}
