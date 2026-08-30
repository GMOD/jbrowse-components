/**
 * #api core/configuration
 * The "apply this to every open track of this type" affordance on a menu row —
 * the trailing `PushPin`, bundled so the row consumes it as one prop. Built by
 * {@link makePin}.
 *
 * `active` = this value is currently the session default (a filled pin), which
 * is the state, not the click. `toggle` **applies the value to every open track
 * of the display type** and raises a snackbar whose one action promotes it to
 * the display type's default; on an already-promoted value it clears that
 * default instead, touching no track (see `applyPinClick`).
 *
 * **`toggle` rather than an `apply`/`clear` pair**, which was tried and dropped:
 * the sole renderer is a MUI `ToggleButton` whose `onChange` means exactly
 * "flip", so splitting it adds a member *and* a branch at the one call site that
 * never needed one. `active` is already public for a caller that wants to state a
 * direction. (The house preference for explicit setters over toggles is about MST
 * actions, where a toggle destroys the ability to set a known state; nothing here
 * stores a value.)
 *
 * Lives here, alone and with no imports, rather than beside `makePin` in
 * `promotableDefaults.ts`: the menu types describe a pin without building one,
 * and `MenuTypes.ts` taking this one interface from that module gave a
 * React-free type file a type closure of 374 files. See
 * `agent-docs/ideas/barrels-block-extraction.md` and `scripts/moduleClosure.ts`.
 */
export interface Pin {
  /**
   * The promotable slot this pin promotes a value of. Nothing in the UI reads
   * it — a pin renders from `active`, `onValue` and the toggle. It is here so a
   * *built menu* can be asked which promotable slots it offers a pin for, which
   * is the only way that question has an answer: declaring `promotedBase` is a
   * schema fact and the pin is a menu fact, and a display that inherits the slot
   * but never builds a row has a slot nothing can ever promote, silently
   * (`promotableSlotsWithoutPin`, guarded by
   * `products/jbrowse-web/src/tests/PromotablePinCoverage.test.ts`).
   */
  slot: string
  /**
   * The value `toggle` promotes — the on-value {@link makePin} was given, or the
   * track's current resolved value for the value-omitted form.
   *
   * `PinAdornment` words itself from this, and has to: a **boolean** on-value
   * promotes a *state*, so a row whose label names the setting rather than a
   * value ("Show legend") gets a pin that promotes hiding the legend as often as
   * showing it. Every other on-value IS what the row's label says — a radio
   * option, a slider's current size — so those keep the value-shaped copy.
   *
   * Required, like `slot`: a pin that cannot say what it promotes is what let
   * that copy state the opposite of what the click does.
   */
  onValue: unknown
  active: boolean
  toggle: () => void
}
