---
name: the-pin-does-two-jobs-and-shows-one
description: The promotable pin's click edits the open tracks while its filled state reports the display-type default, so the control cannot be learned and every fix trades one wart for another — which is why ADR-048 has been reversed twice and re-reviewed many times since. The way out is to stop asking one control to carry both jobs, and the reversal that failed on 2026-09-07 is not the one proposed here. Read before filing another findings list about the pin.
---

# The pin does two jobs and shows one

Mechanism: [reference/DISPLAY_TYPE_DEFAULTS.md](../reference/DISPLAY_TYPE_DEFAULTS.md).
Decision this would supersede:
[ADR-048](../architecture-decision-records/adr-048-the-pin-applies-then-offers-the-default.md).
Decisions it leaves standing:
[ADR-046](../architecture-decision-records/adr-046-resolveconf-names-the-cascade.md),
[ADR-047](../architecture-decision-records/adr-047-undefined-is-the-only-inherit-sentinel.md),
[ADR-063](../architecture-decision-records/adr-063-promotable-defaults-stay-read-time.md).
Interlocks with
[how-permanent-a-promoted-default-is.md](how-permanent-a-promoted-default-is.md),
whose third axis this reopens, and
[promotable-slot-ui.md](promotable-slot-ui.md) §1, whose admin tier changes what
a filled pin means.

**The cascade is not the problem.** `resolveSlot` — track value, then session
default, then `promotedBase` — is sound, well tested and worth keeping exactly
as it is. Everything below is about the control drawn beside a menu row.

## The diagnosis

One pin carries two unrelated jobs, and draws the state of only one:

- the **click** writes a value into every open track of the display type, a
  bulk config edit;
- the **fill** reports whether that value is the display-type default, a
  preference.

DISPLAY_TYPE_DEFAULTS.md says this outright — "**The state is not the click**",
"the ordinary way to reach filled is two clicks" — and ADR-048 names it as "the
one genuinely awkward thing here". A toggle button whose selected state
describes something other than what its click does cannot be learned, and no
adjustment to either half makes it learnable.

Every complaint the subsystem keeps collecting is a symptom of that one thing:

- **A base-valued row's pin can never fill.** `applyAndOfferDefault` maps a base
  value to `undefined`, so the fill tracks a promotion the base never produces.
  Every radio group has one row whose pin is inert by construction.
- **A checkbox row's pin means something else.** `makeTogglePin` redefines
  `active` to mirror the row, so the same glyph means "this is your default" on
  one row and "the box is ticked" one row above it. That redefinition was itself
  a fix for the fill being unreadable on checkbox rows.
- **Applying a base value detaches every open track from the cascade.** Verified
  2026-09-09 against a fixture session: pinning the `promotedBase` row with
  nothing promoted leaves every open display `customized`, makes the
  "Set as the default" offer a silent no-op, and stops any default promoted
  later from reaching those tracks. Same for a toggle pin flipped back to its
  base state. It also raises the "Edited" pencil on every one of them, and
  `TrackSettingsChangesDialog` passes no `onResetRow`, so the only undo is a
  whole-track config reset.
- **The intent arrives as a toast action.** The thing the user came for is the
  snackbar's one button, over a message that names no setting; two pins clicked
  in a row queue two identical toasts (`pushSnackbarMessage` skips its dedupe
  whenever actions are present), and nothing confirms after either is taken.
- **In admin mode the click edits `config.json`.** `setConf` →
  `BaseTrackModel`'s persist reaction → `updateTrackConfiguration` → (adminMode)
  `jbrowse.tracks` → `JBrowse.tsx`'s `onSnapshot` POST. One click on a control
  whose promoted half lives in the admin's own localStorage rewrites the site
  config for every visitor.

## Why it has not converged

ADR-048 has been **reversed twice and amended three times in ten weeks**, and the
question has been put to fresh sessions repeatedly since. That is not
carelessness; it is what an overloaded control does to everyone who touches it.

| When | Shape | Why it went |
| --- | --- | --- |
| 2026-07 | Pin writes the default and nothing else ("the stylesheet reading") | Judged to do the wrong thing for what users click a pin for; a click on a customized track was silent |
| 2026-08-29 | Click applies to open tracks, snackbar offers the default | Standing today |
| 2026-09-02 | Checkbox rows get a toggle pin whose fill mirrors the row | The symmetric pin beside an unchecked box applied *off* everywhere and visibly did nothing |
| 2026-09-07 | One pin meaning again, checkbox pin carrying the row's current value | Same failure, live: the pin beside an unchecked "View as pairs" applied *off* to every open track and changed nothing on screen |
| 2026-09-07 | `TogglePin`/`ValuePin` split, typed per row kind; promoting base clears | Standing today |

Each of those is a real failure of a real shape. What none of them touched is
the premise that these are one control — and roughly sixty unit tests, a
coverage guard, an ADR and a 79KB spec now sit on top of that premise, which is
what makes it read as decided rather than as the thing to question. A session
that accepts it can only find symptoms, and a symptom fix trades one wart for
another, which is exactly the oscillation the table records.

**The 2026-09-07 reversal is not the proposal below, and its failure does not
carry over.** What failed there was a hybrid: keep the bulk apply, but make the
fill mirror the row. The pin still applied, so beside an unchecked box it
applied `off` to tracks already showing `off` and nothing moved. Under the
proposal the pin does not apply at all — promoting `off` moves every *following*
track off, which is visible, and the fill moves, which is visible. The recorded
objection is against a shape that kept the apply.

## The proposal

**The pin column reports the display-type default, the way the check column
already reports the track's own value.** Two parallel columns down the menu, one
meaning each, one sentence to teach.

Concretely, in `promotableDefaults.ts`:

- `active` becomes `deepEqual(promoted ?? base, onValue)`. In any radio group
  exactly one pin is filled at all times — that is the value tracks of this type
  get — so the column reads as state instead of as an occasional badge, and a
  base row's pin becomes a correct, clickable state rather than an inert one.
- `toggle` calls `setDisplayTypeDefault` and stops. Promoting the base value
  still stores `undefined`; it just no longer needs to be spelled as a clear,
  because the base row's pin filling *is* the cleared state.
- The snackbar loses its action and names the setting: "Compact is now the
  default for alignments tracks". Feedback is the fill moving, which one click
  now achieves.

This is the 2026-07 stylesheet reading, restored — with the feedback problem
that sank it fixed at the source rather than by giving the click a second job.
The reason it read as silent was that a filled/outline pin only ever moved on a
promotion, so most clicks changed nothing a user could see. A column where
exactly one row is always filled moves on every click.

### What it deletes

- `applyAndOfferDefault`, `clearDefault`, `applySlotToOpenTracks`, and
  `openTracksOfType` (the share/export bake keeps `openPromotableDisplays`).
- The snackbar action, the two-click escalation, and the "the action closes over
  the display type" reasoning that exists only because the promotion outlives
  the click that raised it.
- **The whole `TogglePin`/`ValuePin` split**: `ToggleStates`, `misKindedPins`,
  the per-row-kind `pin` typing in `toggleMenuItems.ts`, and the
  `makeTogglePin(self, 'linkedReads', { on, off })` state-naming. That split
  exists *only* because of the apply — a checkbox row needed a pin that applied
  something visible, and the row's current state was not it. With no apply, one
  builder covers every row: a checkbox row's pin promotes the state the box
  shows.
- The admin-mode `config.json` write, the "Edited" pencil on every open track,
  and the coarse-undo hazard — nothing writes a track config any more.

### What it costs, stated plainly

**A track the user already customized will not move when a default is set.**
That is the one thing the bulk apply buys, and ADR-048's reversal was decided on
it. The cascade's answer is that a customized track wins by design and the
track-selector badge already offers it a reset — but the case is real, and it is
the whole of the disagreement.

Two ways to answer it, and this is the open question:

1. **Give the bulk apply its own named row.** "Apply to all open alignments
   tracks", a plain action row that dismisses the menu and says what it does.
   Honest about being a bulk edit, undoable on its own terms, and no longer
   pretending to be a state.
2. **Drop it.** Setting the default already moves every open track that has not
   been individually customized, which is most of them, and picking a value on a
   track is a deliberate act the user can undo the same way.

Recommendation: **2**, and add the row later if the gap actually bites. It is
the smaller surface, and the evidence that the apply is wanted is an assertion
in ADR-048 ("the click they mean far more often"), not a measurement.

### Two things to fix regardless of which way that goes

- **`readConnectionsDown`'s pin is unreachable in the default state.**
  `readConnections.ts` gates the "Arc / read cloud band options" submenu on
  `readConnections !== 'off'`, whose `promotedBase` is `'off'`, and
  `CascadingMenu` computes `isOpen = … && !item.disabled`, so the panel never
  opens. `pinnedSlots` walks `subMenu` without reading `disabled`, so
  `PromotablePinCoverage.test.ts` counts the slot as covered — the guard written
  for exactly this gap reports green, against its own comment about "can a user
  reach this pin at all". `readConnections.test.tsx` pins the current shape.
- **The pin is pointer-only and renames its row.** MUI's `Menu` preventDefaults
  `Tab` and closes, and `MenuList` arrow-navigation focuses menu items rather
  than their descendants, so the `ToggleButton` cannot be reached from the
  keyboard. Meanwhile MUI's `Tooltip` puts an `aria-label` on the wrapper span,
  which the row absorbs — measured: a "Show soft clipping" row announces as
  `"Show soft clipping Turn Show soft clipping on for all open tracks of this
  type"`, and `pinCopy`'s carefully worded button label is never spoken.

## What would make this one stick

The first two reversals flipped because neither shape was ever stated as a rule
the tree could enforce — each was a paragraph of judgment, and the next session's
judgment differed. This shape has one:

> The check column reports the track's value. The pin column reports the display
> type's default. Neither column's click writes the other's subject.

That is checkable rather than remembered. `misKindedPins` becomes unnecessary
(there is one kind), and its replacement is a test asserting that every radio
group over a promotable slot draws exactly one filled pin in every state — which
fails on any future attempt to give the pin a second job, because a second job
is what breaks the invariant.

If that rule is not one we are willing to hold, the honest move is the opposite
one: delete the pin, keep the bulk apply as a named row, and let the Preferences
inventory be the only place a display-type default is set. A control nobody can
state a rule for is worse than one fewer control.
