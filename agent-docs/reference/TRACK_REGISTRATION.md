---
name: track-registration
description: The three destinations a track config can land in (sessionTracks, trackConfigDeltas, jbrowse.tracks), the six actions that route between them, and the 4 destination values a consumer can tell apart. Read before adding a track-registration action.
audience: internal
kind: spec
---

# Track registration: session, catalog, delta

A track config reaches a session by one of three routes, and which one it takes
depends on who is asking and what already exists. This spec enumerates the
leaves, groups them by what a consumer can tell apart, and reports both counts,
on the template of [REGION_TOO_LARGE.md](REGION_TOO_LARGE.md).

| Code | Path |
| --- | --- |
| The full routing mixin (session/catalog/delta, web) | `packages/product-core/src/Session/SessionTracks.ts` |
| The base mixin (catalog only, desktop) | `packages/product-core/src/Session/Tracks.ts` |
| Shared track-menu actions and gating | `packages/product-core/src/Session/TrackMenu.ts` |
| Catalog write with no dedupe | `packages/app-core/src/JBrowseModel/index.ts` `addTrackConf` |
| Dev-only contract check | `packages/product-core/src/Session/temporaryAssemblyTracks.ts` |
| Capability guards | `isSessionWithAddSessionTrack`, `isSessionWithPublishTrackConf`, `isSessionWithSessionTracks`, `isSessionWithAddTracks` in `packages/core/src/util/types/index.ts` |
| ADR for the temporary-assembly refusal | [ADR-084](../architecture-decision-records/adr-084-a-view-local-track-config-rides-on-its-track.md) |
| Working invariants (delta caching, reset-not-delete) | `packages/product-core/src/Session/CLAUDE.md` |

Tests: `UpdateTrackConfiguration.test.ts` is the named canary in
`Session/CLAUDE.md`, and `TrackConfigWorkingCopy.test.ts` pins a slot reset holding on screen; `pluginFacingSessionApi.test.ts`
pins the deprecated `addTrackConf` alias two prebuilt plugin bundles still call
by name at runtime.

## The three destinations, and who has them

- **`jbrowse.tracks`** (the catalog) — what the config.json the admin server
  hands every visitor carries. Every product has this.
- **`sessionTracks`** — the tracks the session added: a non-admin's added and
  copied tracks, and every track a feature, a session spec, a share link or an
  agent stands up. Each entry is the base its edits diff against. Travels with
  the session; never reaches the catalog. `SessionTracksManagerSessionMixin`
  holds it; the base `TracksManagerSessionMixin` has no separate store.
- **`trackConfigDeltas`** — a track's edited slots, stored as a diff against its
  base (its `sessionTracks` or catalog entry) rather than a full shadow, so a
  later change to an untouched field of the base still flows through
  ([ADR-158](../architecture-decision-records/adr-158-a-session-tracks-entry-is-the-base-its-edits-diff-against.md)).

So the base mixin has **one** destination regardless of which action is called
or who is calling: `jbrowse.tracks`. The session-tracks mixin has **three**,
and the routing logic below exists entirely to pick among them.

## The six actions

`addSessionTrackConf`, `publishTrackConf`, `addTrackConf` (deprecated alias of
the first), `updateTrackConfiguration`, `resetTrackConfiguration`,
`deleteTrackConf`. Repo `CLAUDE.md`'s rule — `addSessionTrackConf` is the
default, `publishTrackConf` only for Add-track workflows — is the policy this
spec's leaf count is the shape of.

## Leaf branches: 27

Walking every conditional in the six actions, across both mixins, to a
terminal effect (a write, a no-op, a thrown error, or a snackbar):

**`addSessionTrackConf` / `addTrackConf`** (identical code path in both
mixins — the alias delegates to the same closure, contributing no branches of
its own): base mixin 2 (missing `type` throws; success is an **unconditional
push**, no dedupe), override mixin's shared `addToSession` 4 (missing `type`
throws; `getTrackById` resolves an existing entry — session, catalog, assembly
sequence, or connection — and returns it unchanged; `sessionTracks.push`
succeeds; `sessionTracks.push` throws on an invalid config, caught into
`notifyError`). Subtotal: **6**.

**`publishTrackConf`**: base mixin delegates to the same 2 leaves as its
`addSessionTrackConf` (catalog, unconditional push) — no new branches. Override
mixin: non-admin routes into `addToSession`'s existing 4; admin with every
named assembly in the catalog routes into the base mixin's 2 (via
`superPublishTrackConf`); admin naming an assembly the catalog does not carry
routes into `addToSession`'s 4 again, but now paired with an info snackbar
naming the assembly — a genuinely new terminal state layered on an existing
one. Subtotal: **1** new leaf.

**`updateTrackConfiguration`** (override mixin only; base mixin's own version
is folded into case C below): **8**. Case A (editing a track with a base,
its `sessionTracks` or catalog entry) — the new delta differs from any existing one (2: does the
programmatic-sync half apply or no-op) × does an *existing* identical delta
already exist so the write is skipped instead of stored (2) = 4, plus nets back
to base and a delta existed (1: cleared, working copy reverted), plus nets back
to base with no delta to clear (1 true no-op) = 6. Unsetting a slot the base
sets is not a net-back: the delta records it as a `null`.
Case C (a connection track, or a track with no base — routed to the base
mixin's `updateTrackConfiguration`): connection-track branch vs
catalog-write branch, which writes nothing for a track the catalog lacks = 2.
The embedded products' `jbrowse` (`createConfigModel`) has no `updateTrackConf`,
so there the catalog-write branch throws instead.

**`resetTrackConfiguration`**: delta present → cleared and the working copy
reverted; delta absent → no-op. **2**.

**`deleteTrackConf`**: override mixin — `dereferenceTrack` always runs (closes
every open view showing the track), independent of the rest; whether the
catalog entry is removed depends on `adminMode` (2); whether a leftover delta
also gets cleared is independent (2); whether a `sessionTracks` entry gets
spliced out is independent of both (2) — 2×2×2 = **8**, including a leaf the UI
never offers but the action does not guard against: a non-admin "deleting" a
catalog-owned track dereferences every open view and removes nothing from any
store, since it is neither an admin catalog-delete nor a `sessionTracks`
splice.

6 + 1 + 8 + 2 + 8 = **25**, plus 2 more accounted for above inside the
`addSessionTrackConf`/`publishTrackConf` subtotals' "missing type" throws being
genuinely separate code sites in the two mixins (already counted once each
above) — **27** named terminal branches in total.

## What a consumer can tell apart: 13

Two branches are the same *state* when nothing downstream can distinguish
them. The clearest case: Case A's "identical delta, sync applies" and "new
delta, sync applies" write the same eventual `trackConfigDeltas[trackId]` and
leave the working copy in the same place — 4 of the 6 Case-A leaves collapse to
2 (a delta gets stored or it does not; a working copy gets synced or it does
not are the only two axes anything reads). Grouping every leaf by (which store
now holds the config or the fact that nothing changed, whether a snackbar fired
and which kind, whether the edited badge would light):

1. added to `sessionTracks` (silent)
2. add to `sessionTracks` refused — invalid config (error snackbar)
3. deduped — resolved to an existing entry, nothing written (silent)
4. added to `jbrowse.tracks` (silent, admin/desktop)
5. added to `sessionTracks` instead of `jbrowse.tracks` because the config
   names an assembly the catalog does not carry (info snackbar)
6. missing `type` — thrown, uncaught, never reaches a snackbar
7. delta written or restamped, edited badge on
8. delta cleared, working copy reverted on screen (implicit reset)
9. true no-op — nothing to clear, nothing changed
10. an opened connection track's config is edited in place
11. deleted from `jbrowse.tracks` (admin), views dereferenced
12. deleted from `sessionTracks` (non-admin's own track), views dereferenced
13. dereferenced with nothing removed from any store — the unguarded
    non-admin-delete-of-a-catalog-track leaf above

**13**, not 27: the routing logic's job is almost entirely to pick a
*destination*, and most of the branch count is two or three code paths
reaching the same destination by a different route (dedupe-vs-add,
admin-vs-desktop, sync-applies-vs-not).

## What actually gets read: 4 destinations, plus three small side channels

Nothing downstream reads all 13 outcomes as 13 separate cases. Four consumers,
each asking one narrow question:

- **The `tracks` getter** (what renders): which of {session, catalog,
  delta-merged-over-its-base, connection} a track's live config now comes from.
  **4 values.** This is the axis every one of the 13 outcomes ultimately
  reduces to.
- **`isTrackOverride`** (the edited badge): on or off, computed from
  `flattenTrackConfigDelta`'s *changed-slot* count, not from bare key presence
  in `trackConfigDeltas` — a delta holding only content-free display stubs
  reads as off. **2 values.**
- **The track menu's `isSessionOverride`** ("Reset track settings"): whether
  the track carries changed slots over its base, `isTrackOverride`. **2
  values**. Delete stays beside Reset wherever `canEdit` holds, as it does for
  a session track.
- **The snackbar surface**: none, an invalid-config error, or the
  missing-assembly info notice. **3 values**, and only 2 of the 27 branches
  ever produce a non-none one.

4 × 2 × 2 × 3 = 48 combinatorial slots; the 13 outcomes above occupy few of
them, because a "which store" answer of `connection` never co-occurs with an
edited badge (only a track with a base can have a delta), and the snackbar
values only ever pair with the session-add destination.

## Verdict

**The shape holds up.** 27 branches sounds like a lot for six actions, but most
of them exist because the same three-way dedupe-or-write-or-throw pattern
(`addToSession`) is walked by hand at several call sites
instead of shared once — that is code duplication, not state-space growth, and
it collapses cleanly once grouped by destination. The genuine complexity is
real and load-bearing: three destinations exist because a catalog write, a
per-user addition, and a per-user *edit* of either are three
different persistence and sharing semantics, and `Session/CLAUDE.md`'s
documented invariants (delta caching keyed to the value it mirrors, a reset
recorded as a `null`) exist because getting either wrong loses a keystroke
mid-edit or silently undoes a reset the user just watched land. A four-value destination is the honest floor for what this concept
has to express.

**Two findings worth fixing, not smoothing over in the writeup:**

- `jbrowse.addTrackConf` (`packages/app-core/src/JBrowseModel/index.ts`) does
  an **unconditional push with no dedupe**, unlike `addToSession`'s
  `getTrackById` check. A repeated add through the desktop mixin, or an admin
  `publishTrackConf` call that races itself, can push two catalog entries
  sharing one `trackId` — a state `addToSession`'s dedupe exists specifically
  to prevent on the session side. Nothing here validates catalog-side
  uniqueness before the write.
- `deleteTrackConf`'s leaf 13 (a non-admin calling delete on a catalog-owned
  track dereferences every open view and removes nothing from any store) is
  reachable by any caller that does not go through the track menu's
  `isSessionOverride`-gated UI, including a plugin. It is a silent no-op
  standing in for what should be a refusal.
