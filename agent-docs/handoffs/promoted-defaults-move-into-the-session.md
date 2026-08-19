---
name: promoted-defaults-move-into-the-session
description: Deleting the localStorage tier under promoted display-type defaults and keeping the map in the session snapshot instead, which removes the share bake outright and closes the hole that bake documents as unclosable. The order to do it in, what each step breaks, and the two guard tests that decide whether the store swap is safe.
---

# Promoted defaults move into the session

Not started. Close this file by deleting it when the work lands; if it stalls,
move the remainder into [ideas/](../ideas/README.md).

Mechanism this changes: [reference/DISPLAY_TYPE_DEFAULTS.md](../reference/DISPLAY_TYPE_DEFAULTS.md).
Decisions it leaves standing: [ADR-046](../architecture-decision-records/adr-046-resolveconf-names-the-cascade.md),
[ADR-047](../architecture-decision-records/adr-047-undefined-is-the-only-inherit-sentinel.md),
[ADR-048](../architecture-decision-records/adr-048-pin-edits-the-stylesheet-not-the-elements.md).

## The finding

The cascade is not where the promotable subsystem's weight is. `resolveSlotIn`
is about 20 lines of logic; roughly 1,290 lines exist only for this subsystem,
and they cluster at the **persistence boundary**.

`setDisplayTypeDefault` writes `preferencesOverrides`, which
`Preferences.ts:64` mirrors to localStorage. That makes a promoted default
personal and local, which means it cannot leave the browser, which means every
exit from the live tree needs its own pass to flatten the cascade. There are
three: the worker payload (`getConfigSnapshotWithPromotables`), the About
dialog's copy-config (`getTrackConfigWithPromotables`), and the share bake —
133 of `shareableSnapshot.ts`'s 235 lines, carrying a hole its own comment
records as unclosable, because a slot the sender was deliberately viewing at
base is byte-identical to an unset one after `stripDefault`.

Moving the store into the session snapshot deletes the second of those and the
composite-key encoding that feeds the Preferences dialog, and closes the hole
for free: the recipient of a shared session reads the sender's defaults rather
than their own.

**This replaces the persisted tier rather than layering a session tier above
it.** Layering was the first sketch and it is the additive version — it costs a
`promoted`/`userPromoted` split, a precedence rule, two-tier unpin, and a second
place for a default to hide.

## What does not change

`getDisplayTypeDefault(type, slot)` stays the only thing `resolveSlotIn` calls
(`promotableResolve.ts:195`), and `PromotedDefaultStore` stays the narrow
interface it is called through. So the resolver, `makePin`, the badge, the
worker payload, the copy-config flatten, and all 28 session fakes in the repo
are untouched by the store swap. That containment is the reason this is worth
doing as one change rather than a rewrite.

## Order of work

### 1. Move the store (`packages/product-core/src/Session/BaseSession.ts`)

Add a snapshot property — `types.map(types.frozen())`, keyed by the same flat
`<displayType>\0<slot>` composite string, defaulting to empty. Point
`getDisplayTypeDefault` and `setDisplayTypeDefault` at it.

**Keep the flat key.** It is not a storage convenience: the comment at
`BaseSession.ts:33` records that a single nested `displayTypeDefaults` object
made promoting one default wake every other default's readers, and every
promotable display reads one in its `rpcProps`. One key per tracked entry is
what keeps that from coming back.

Then delete, in the same file: `DISPLAY_TYPE_DEFAULT_PREFIX`,
`parseDisplayTypeDefaultKey`, `DISPLAY_TYPE_DEFAULTS_PATH_HEAD`, the
promoted-default branch in `getPreferenceChanges`, and the branch in
`resetPreferenceChange`. About 80 lines.

`clearPreferenceOverrides` ("Reset to defaults" in the Preferences dialog) stops
clearing promoted defaults — see step 3.

### 2. Delete the share bake (`shareableSnapshot.ts`)

Remove `bakePromotedDefaultsIntoSnapshot`, the `Bake` interface, `ownTrackConfig`
and `bakeValues`. `bakeWorkspacesIntent` stays, so `bakeSessionCascades` survives
as a one-call wrapper — it is exported from two barrels and called directly by
desktop's `buildWebExport.ts:67`, so leave the name alone in this change.

The four share/export entry points then carry promoted defaults the same way they
carry every other session fact.

### 3. Decide where clearing and seeing them live

Promoted defaults stop being preference overrides, so they leave the Preferences
dialog. They must not become invisible state. The track-selector badge already
offers `clearPromotedDefaults` per display type; the gap is the session-wide
"what have I pinned, and clear it all" that "Reset to defaults" was providing.
Cheapest honest answer: one session-level menu item over the same map. Settle it
before step 1 lands, because the dialog change is what makes the deletion in
step 1 safe to review.

### 4. Docs

`DISPLAY_TYPE_DEFAULTS.md` states "personal, localStorage-backed, and
deliberately never serialized into a shared session" in more than one place, and
has a section on the bake. A new ADR should record why the promoted default
lives in the session document rather than in preferences, and it supersedes the
sharing half of the current text rather than adding to it.

`ideas/promotable-slot-ui.md` §1 gets stronger, not weaker: with the user tier
session-scoped, the admin `preferences.displayTypeDefaults` slot (~15 lines)
becomes the way an install gets a permanent house default, and it is read
through the same one method.

## What this deliberately does not add

**No "Always, in every session" action on the toast.** It reintroduces the tier
this work deletes, and with it the honesty split (a pin's `active` would have to
distinguish effective from user-set) and two-tier unpin. If per-user permanence
turns out to be wanted, it is one checkbox that persists the same map — a storage
flag, not a second tier in the cascade.

## Behavior changes to state in the release notes

- A pinned default dies when the session does, and travels when the session is
  shared or exported. Both are inversions of today.
- No migration path is needed if `BaseSession.ts:41` is still true ("nothing
  released stores these yet"). **Re-check that against the shipped v5 release
  before landing** — if it is false, orphaned `displayTypeDefault\0` keys sit in
  users' `jbrowsePreferences` forever.

## The two guard tests that decide the store swap

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

## Tests that need rewriting

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

## Open questions

- Adding a property to `BaseSession` puts the key in every product's session
  snapshot, embedded included, where `preferencesOverrides` was volatile and
  empty. Additive, but embedded consumers who diff or store session snapshots
  will see it.
- Whether the session-wide clear belongs on the session menu or on the track
  selector beside the existing per-type badge action.
