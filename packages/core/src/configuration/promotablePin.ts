/**
 * Shared by both pin kinds: which promotable slot the pin writes, whether it
 * draws filled, and the one click it takes.
 *
 * `slot` is here so a *built menu* can be asked which promotable slots it offers
 * a pin for, which is the only way that question has an answer: declaring
 * `promotedBase` is a schema fact and the pin is a menu fact, and a display that
 * inherits the slot but never builds a row has a slot nothing can ever promote,
 * silently (`promotableSlotsWithoutPin`, guarded by
 * `products/jbrowse-web/src/tests/PromotablePinCoverage.test.ts`).
 *
 * **`toggle` rather than an `apply`/`clear` pair**, which was tried and dropped:
 * the sole renderer is a MUI `ToggleButton` whose `onChange` means exactly
 * "flip", so splitting it adds a member *and* a branch at the one call site that
 * never needed one. `active` is already public for a caller that wants to state
 * a direction.
 *
 * Lives here, alone and with no imports, rather than beside `makePin` in
 * `promotableDefaults.ts`: the menu types describe a pin without building one,
 * and `MenuTypes.ts` taking this from that module gave a React-free type file a
 * type closure of 374 files. See `agent-docs/ideas/barrels-block-extraction.md`
 * and `scripts/moduleClosure.ts`.
 */
interface PinBase {
  slot: string
  /** what `toggle` writes into every open track of the display type */
  onValue: unknown
  active: boolean
  toggle: () => void
}

/**
 * #api core/configuration
 * The pin on a radio or slider row, built by {@link makePin}: `onValue` is the
 * row's own value, `active` means that value is the display type's promoted
 * default, and `toggle` on an outline pin applies the value to every open track
 * and offers it as the default, while on a filled pin it clears that default
 * and touches no track (`applyAndOfferDefault` / `clearDefault`).
 */
export interface ValuePin extends PinBase {
  kind: 'value'
}

/**
 * #api core/configuration
 * The pin on a checkbox row, built by {@link makeTogglePin}: the row's own
 * checkbox over every open track of the display type. `active` mirrors the row,
 * `onValue` is the state a click applies (the row's opposite), and `toggle`
 * applies it everywhere and offers it as the default. It never clears a default
 * on its own — promoting the slot's base value is what clears one.
 */
export interface TogglePin extends PinBase {
  kind: 'toggle'
}

/**
 * #api core/configuration
 * The "apply this to every open track of this type" affordance on a menu row —
 * the trailing `PushPin`, bundled so the row consumes it as one prop.
 *
 * `kind` is what the adornment words itself from and what the row builders
 * check: a checkbox row takes a {@link TogglePin}, a radio or slider row a
 * {@link ValuePin}. The two used to be told apart by `typeof onValue ===
 * 'boolean'`, which let a value pin over a boolean slot compile and read as a
 * toggle while clearing on its second click.
 */
export type Pin = ValuePin | TogglePin
