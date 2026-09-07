/**
 * #api core/configuration
 * The "apply this to every open track of this type" affordance on a menu row —
 * the trailing `PushPin`, bundled so the row consumes it as one prop. Built by
 * {@link makePin}.
 *
 * One meaning on every row kind. `onValue` is the row's own state: the option
 * a radio row stands for, the slider's current value, a checkbox's current
 * checked state. `active` = that state is the display type's promoted default
 * (a filled pin), which is the *state*, not the click. `toggle` on an outline
 * pin applies the state to every open track of the display type and raises a
 * snackbar whose one action promotes it to the display type's default; on a
 * filled pin it clears that default instead, touching no track
 * (`applyAndOfferDefault` / `clearDefault`). So the row's glyph shows what
 * this track does, the pin's fill shows what the display type defaults to, and
 * the menu is where a default is both set and undone.
 *
 * **`toggle` rather than an `apply`/`clear` pair**, which was tried and dropped:
 * the sole renderer is a MUI `ToggleButton` whose `onChange` means exactly
 * "flip", so splitting it adds a member *and* a branch at the one call site that
 * never needed one. `active` is already public for a caller that wants to state
 * a direction.
 *
 * `slot` is here so a *built menu* can be asked which promotable slots it offers
 * a pin for, which is the only way that question has an answer: declaring
 * `promotedBase` is a schema fact and the pin is a menu fact, and a display that
 * inherits the slot but never builds a row has a slot nothing can ever promote,
 * silently (`promotableSlotsWithoutPin`, guarded by
 * `products/jbrowse-web/src/tests/PromotablePinCoverage.test.ts`).
 *
 * Lives here, alone and with no imports, rather than beside `makePin` in
 * `promotableDefaults.ts`: the menu types describe a pin without building one,
 * and `MenuTypes.ts` taking this from that module gave a React-free type file a
 * type closure of 374 files. See `agent-docs/ideas/barrels-block-extraction.md`
 * and `scripts/moduleClosure.ts`.
 */
export interface Pin {
  slot: string
  /** what `toggle` writes into every open track of the display type */
  onValue: unknown
  active: boolean
  toggle: () => void
}
