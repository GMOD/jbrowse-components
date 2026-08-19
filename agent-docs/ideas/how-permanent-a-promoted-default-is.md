---
name: how-permanent-a-promoted-default-is
description: A promoted display-type default is permanent on three axes at once — it outlives the session, it travels into a share, and it governs tracks the user has not opened yet — and the subsystem's cost sits almost entirely in the localStorage tier the first axis needs. Two independent ways to reduce it: move the store into the session snapshot, or give the pin a scope so "apply to the tracks I have open" is expressible. Read before reopening either; the session move acquired a blocker on 2026-08-19 that its own step order does not survive.
---

# How permanent a promoted default is

Parked. Mechanism this would change:
[reference/DISPLAY_TYPE_DEFAULTS.md](../reference/DISPLAY_TYPE_DEFAULTS.md).
Decisions it leaves standing:
[ADR-046](../architecture-decision-records/adr-046-resolveconf-names-the-cascade.md),
[ADR-047](../architecture-decision-records/adr-047-undefined-is-the-only-inherit-sentinel.md),
[ADR-048](../architecture-decision-records/adr-048-pin-edits-the-stylesheet-not-the-elements.md),
[ADR-063](../architecture-decision-records/adr-063-promotable-defaults-stay-read-time.md).
Interlocks with [promotable-slot-ui.md](promotable-slot-ui.md) §1, whose admin
tier is the third place a default could live.

## The question

Clicking a pin says "this value is the default for all tracks of this type". It
does not say for how long, for whom, or over which tracks — and the answer today
is the largest one available on all three counts. A user who wanted their six
open alignments tracks compact gets a preference that also governs the seventh
they open tomorrow, survives every reload, and is baked into the next session
they share.

That is the motivation for changing anything here. The line count below is the
evidence, not the reason.

## Three axes, and they are independent

| Axis | Today | What sets it |
| --- | --- | --- |
| Outlives the session | yes | `preferencesOverrides` → localStorage (`Preferences.ts`) |
| Reaches other people | yes, as baked per-track values | `bakePromotedDefaultsIntoSnapshot` |
| Governs tracks not yet opened | yes | the cascade resolving at read time (ADR-063) |

The two proposals below take one axis each and do not depend on each other. The
third axis is the one ADR-063 settled and is not in scope: writing promoted
values into tracks at pin time destroys retroactive revert-on-clear, and that
ADR should not be reopened as a cleanup.

## Option A — move the store into the session snapshot

Takes the first axis, and the second falls out.

### The finding

The cascade is not where the subsystem's weight is. `resolveSlotIn` is about 20
lines of `promotableResolve.ts`'s 223, and the subsystem's eight core files
(`promotableResolve`, `promotableDefaults`, `promotableSlots`, `slotShape`,
`fullConfSnapshot`, `openDisplays`, `promotableMenuItems`, `PinAdornment`) come
to 1,250 lines between them. What is expensive clusters at the **persistence
boundary**.

`setDisplayTypeDefault` writes `preferencesOverrides`, which the preferences
mixin mirrors to localStorage. That makes a promoted default personal and local,
which means it cannot leave the browser, which means every exit from the live
tree needs its own pass to flatten the cascade. There are three: the worker
payload (`getConfigSnapshotWithPromotables`), the About dialog's copy-config
(`getTrackConfigWithPromotables`), and the share bake — 133 of
`shareableSnapshot.ts`'s 235 lines, carrying a hole its own comment records as
unclosable, because a slot the sender was deliberately viewing at base is
byte-identical to an unset one after `stripDefault`.

Moving the store into the session snapshot deletes the third of those and the
composite-key encoding that feeds the Preferences dialog, and closes the hole for
free: the recipient of a shared session reads the sender's defaults rather than
their own.

**This replaces the persisted tier rather than layering a session tier above
it.** Layering was the first sketch and it is the additive version — it costs a
`promoted`/`userPromoted` split, a precedence rule, two-tier unpin, and a second
place for a default to hide.

### It reduces the second axis as well, which is worth saying out loud

A share today carries the sender's promoted values **baked into the recipient's
track configs**, where they read as *customized* — the top of the cascade. The
recipient undoes that per track. A travelling map is one object they clear once,
and the badge already names its source. So the map is the smaller imposition even
though it is the more visible one.

It is larger on one point, and the drafting of this proposal originally missed
it: a travelling map keeps governing tracks the recipient opens **later**, where
baked values stop at the tracks that existed. If that matters, the answer is to
surface it once on load rather than to keep the bake.

### What does not change

`getDisplayTypeDefault(type, slot)` stays the only thing `resolveSlotIn` calls,
and `PromotedDefaultStore` stays the narrow interface it is called through. So
the resolver, `makePin`, the badge, the worker payload, the copy-config flatten,
and all 17 session fakes that declare the pair are untouched by the store swap. That
containment is the reason this is worth doing as one change rather than a
rewrite.

### Order of work

**1. Move the store** (`packages/product-core/src/Session/BaseSession.ts`). Add a
snapshot property — `types.map(types.frozen())`, keyed by the same flat
`<displayType>\0<slot>` composite string, defaulting to empty. Point
`getDisplayTypeDefault` and `setDisplayTypeDefault` at it.

**Keep the flat key.** It is not a storage convenience: the comment at
`BaseSession.ts:33` records that a single nested `displayTypeDefaults` object
made promoting one default wake every other default's readers, and every
promotable display reads one in its `rpcProps`. One key per tracked entry is what
keeps that from coming back.

Then delete, in the same file: `DISPLAY_TYPE_DEFAULT_PREFIX`,
`parseDisplayTypeDefaultKey`, `DISPLAY_TYPE_DEFAULTS_PATH_HEAD`, the
promoted-default branch in `getPreferenceChanges`, and the branch in
`resetPreferenceChange`. About 80 lines.

**2. Delete the share bake** (`shareableSnapshot.ts`). Remove
`bakePromotedDefaultsIntoSnapshot`, the `Bake` interface, `ownTrackConfig` and
`bakeValues`. `bakeWorkspacesIntent` stays, so `bakeSessionCascades` survives as a
one-call wrapper — two barrels export it and desktop's `buildWebExport.ts:67`
calls it directly, so leave the name alone in this change. The four share/export
entry points then carry promoted defaults the same way they carry every other
session fact.

**3. Answer the clear-everything question. This now blocks step 1 — see below.**

**4. Docs.** `DISPLAY_TYPE_DEFAULTS.md` states "personal, localStorage-backed,
and deliberately never serialized into a shared session" in more than one place,
and has a section on the bake. A new ADR should record why the promoted default
lives in the session document rather than in preferences, and it supersedes the
sharing half of the current text rather than adding to it.

`promotable-slot-ui.md` §1 gets stronger, not weaker: with the user tier
session-scoped, the admin `preferences.displayTypeDefaults` slot (~15 lines)
becomes the way an install gets a permanent house default, read through the same
one method.

### The blocker, which landed on 2026-08-19 after this was drafted

`76e9f52746` made `clearPromotedDefaults(self, slots)` take a **required** slot
list and deleted the all-slots form as a hazard — it reached further than any
list a dialog can have shown. Its doc comment
(`promotableDefaults.ts:461-476`) now names the replacement explicitly:
"Clearing every promoted default at once is a preferences-scope action, and
Preferences → 'Reset to defaults' is where it lives (`clearPreferenceOverrides`)."

Step 1 moves the map out of `preferencesOverrides`, so `clearPreferenceOverrides`
stops reaching it. Between that and the deleted all-slots form, **a session would
have no way to clear its promoted defaults at all** — only the badge's per-type,
per-slot action would remain. So step 3 is not "settle it before step 1 lands for
reviewability"; it is a prerequisite, and whatever answers it has to be built in
the same change.

Cheapest honest answer: one session-level menu item over the same map, which is
also the only surface that still makes sense once the map is session state rather
than a preference.

### The two guard tests that decide the store swap

- `packages/core/src/configuration/promotedValueCloneable.test.ts` — runs in the
  node environment for the real `structuredClone`, because jsdom's shim is a JSON
  round-trip that happily clones a Proxy. The current map declares `deep: false`
  precisely because a MobX Proxy in `rpcProps()` threw `DataCloneError` on
  `postMessage` for any track following an object-valued default. **An MST
  `types.frozen` value being handed back Proxy-free has to be proven by this
  test, not assumed.**
- Per-key reactivity. No test pins "promoting one default does not invalidate a
  reader of another" today; the flat key is held by a comment alone. Add one
  while the store is being swapped — the shape to copy is
  `plugins/gccontent/src/LinearGCContentDisplay/gcParamsInvalidate.test.ts`,
  which pins an `rpcPropsCacheKey` rather than a setter.

### Tests that need rewriting

- `products/jbrowse-web/src/tests/ShareablePromotedDefaults.test.ts` — asserts
  values baked into track configs and `trackConfigDeltas`; becomes an assertion
  that the map itself travels.
- `products/jbrowse-web/src/sessionModel/sessionModelFactory.test.ts:431` —
  "round-trips a promoted default through localStorage across a reload" becomes a
  session-snapshot round-trip.
- `products/jbrowse-desktop/src/components/ExportToWebDialog.test.tsx` — the
  fourth bake caller.
- Both `PreferencesDialog.test.tsx` files (product-core and jbrowse-web) — the
  promoted-default rows go away.
- `products/jbrowse-web/src/tests/CopyConfigPromotedDefaults.test.ts` is
  **unchanged**: copy-config still flattens, and for its own reason (a pasted
  `config.json` is read by a mechanism with no cascade at all).

Every `localStorage.clear()` in a `beforeEach` that exists to stop one test's
promotion leaking into the next becomes unnecessary — grep for the comment, not
just the call.

Run `products/jbrowse-web` explicitly: it is the only jsdom integration layer and
path-scoped runs skip it.

### Behavior changes to state in the release notes

- A pinned default dies when the session does, and travels when the session is
  shared or exported. Both are inversions of today. "Dies when the session does"
  overstates the loss for jbrowse-web, whose autosave restores the session across
  an ordinary reload; what it dies on is a new session or an opened share link.
- **No migration is needed.** The draft said to re-check `BaseSession.ts:43`
  ("nothing released stores these yet") against "the shipped v5 release"; there
  is no v5. The current tag is `v4.3.0`, `promotableResolve.ts` does not exist in
  it, and the changelog since v4.2.1 does not mention the subsystem — it landed
  2026-07-20, after the tag. So no `displayTypeDefault\0` key can be sitting in a
  user's `jbrowsePreferences`, and this is the cheapest moment the design will
  ever have. Re-run the check against whatever tag exists at landing time rather
  than trusting this paragraph.

## Option B — give the pin a scope

Takes the third axis at the level of the gesture rather than the mechanism: the
pin stays what it is, and a peer action offers the smaller commitment. "Apply
this to the tracks I have open" is the case the pin is most often reached for,
and today it is only expressible as a permanent default plus a second click.

### Almost all of it exists

- the walk — `openDisplaysOfType` / `openPromotableDisplays`
- the count — `tracksDifferingFrom`, which `d5b47dd04c` made dedupe by config
  node on 2026-08-19, so a track open in two views of a breakpoint-split counts
  once. That is exactly the count this action wants
- the write — `setConf(display, slot, value)`, the same call every value row
  already makes for one track
- the mirror — `resetSlotToInherit` is this function with the value dropped

What is missing is the additive bulk write, around ten lines, and a place to put
the row.

### It adds no state and no tier

An applied value is an ordinary customized track value. It already travels in
`trackConfigDeltas`, already resolves into the worker payload, already copies out
of the About dialog. None of the ~1,290 lines of persistence machinery in Option
A applies to it, and neither does any part of the cascade.

### Where it stands with the ADRs

ADR-063 rejects apply-time as a **replacement** for the read-time cascade, on the
grounds that it destroys retroactive revert-on-clear. A separately-labelled peer
action is not that; it is the shape ADR-048 already blessed for "Override N
customized tracks", where the pin edits the stylesheet and one explicit gesture
edits the elements.

Two things to get right:

- **The name is already spent.** ADR-048 renamed "Apply to N open tracks" →
  "Override N customized tracks" because the old name read as additive over an
  action that was a bulk *clear*. A genuinely additive apply reclaims the name
  honestly, but that needs an ADR-048 amendment or someone will revert it as a
  regression. The two actions must never appear in the same snackbar.
- **This one is destructive where the pin is not.** Applying overwrites each open
  track's own value, so it takes the count in its label and no toggle affordance.
  Pin-safety is what lets the pin sit on every row; this cannot sit there.

### The caveat the delta layer imposes

`a89461bbf9` (2026-08-19) documents that `diffTrackConfig` records adds and
changes but never deletions, so *unsetting* a slot an admin `config.json`
declares diffs to nothing and does not survive a reload — the no-tombstones
limitation in `trackConfigDelta.ts`.

Applying a value is an add or a change, so this action records and reloads
correctly. The gap is in the undo direction: putting such a track back on the
cascade holds for the session and reverts on reload. Pre-existing, not introduced
here, but it means "fully reversible per track" is too strong a claim to put in
the UI.

### Placement is the open product decision

The gesture is per-value, and a row per value doubles a menu that already carries
a pin on every row. `promotableRadioItems` builds a whole group in one call and is
the natural home for a single trailing row per group — which reaches all four
groups structurally, the same argument that module already makes for the pin. The
checkbox rows (`promotableToggleItem`, most of alignments) have no group to hang
it on and are the unsolved half.

## How they relate

Option B is much smaller, needs no ADR overturned, and covers the common case.
Option A is the one that changes what a pin *is*.

Do B first and independently. It changes the evidence for A: if the scoped action
is what people reach for, the pin is a power-user affordance, and keeping it
localStorage-backed *and* baked into every share is much harder to justify — an
argument from use rather than from line counts. Doing A first settles the
question with neither.

## Open questions

- Adding a property to `BaseSession` puts the key in every product's session
  snapshot, embedded included, where `preferencesOverrides` was volatile and
  empty. Additive, but embedded consumers who diff or store session snapshots
  will see it.
- Whether the session-wide clear (Option A step 3) belongs on the session menu or
  on the track selector beside the existing per-type badge action.
- Whether a received session's defaults should announce themselves once on load,
  which is the only thing that would stop a shared map governing the recipient's
  later-opened tracks silently.
