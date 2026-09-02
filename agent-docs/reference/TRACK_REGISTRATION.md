---
name: track-registration
description: One-page spec (release-validation method) for the session-tracks concept — the three destinations a track config can land in (sessionTracks, trackConfigDeltas, jbrowse.tracks), the six actions that route a track between them, and the count of state a consumer can actually tell apart. 32 named branches across six actions and two session mixins collapse to 17 consumer-visible outcomes and, further, to 4 destination values plus three small side channels a menu or a `tracks` read ever consults. Read before adding a seventh track-registration action, or before trusting that "session vs catalog vs delta" is simpler than it looks.
audience: internal
---

# Track registration: session, catalog, delta

A track config reaches a session by one of three routes, and which one it takes
depends on who is asking and what already exists. This is the one-page spec
[RELEASE_VALIDATION_SAMPLING.md](RELEASE_VALIDATION_SAMPLING.md) asks for on a
second cross-cutting concept: enumerate the leaves, group by what a consumer can
tell apart, report both counts. [REGION_TOO_LARGE.md](REGION_TOO_LARGE.md) is
the template and the first of these.

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

Tests: `UpdateTrackConfiguration.test.ts` and `PromotedDefaultOverride.test.ts`
are the named canaries in `Session/CLAUDE.md`; `pluginFacingSessionApi.test.ts`
pins the deprecated `addTrackConf` alias two prebuilt plugin bundles still call
by name at runtime.

## The three destinations, and who has them

- **`jbrowse.tracks`** (the catalog) — what the config.json the admin server
  hands every visitor carries. Every product has this.
- **`sessionTracks`** — a non-admin's own added/copied tracks. Travels with the
  session; never reaches the catalog. Only the web session composes this store
  (`SessionTracksManagerSessionMixin`) — desktop's session
  (`TracksManagerSessionMixin`) has no separate store, because for a
  single-user desktop app the session scope and the catalog scope are the same
  file.
- **`trackConfigDeltas`** — a non-admin's edited slots on a catalog-owned track,
  stored as a diff against the base rather than a full shadow, so a later admin
  edit to an untouched field still flows through. Web-only, same reason.

So the base mixin (desktop) has **one** destination regardless of which action
is called or who is calling: `jbrowse.tracks`. The override mixin (web) has
**three**, and the routing logic below exists entirely to pick among them.

## The six actions

`addSessionTrackConf`, `publishTrackConf`, `addTrackConf` (deprecated alias of
the first), `updateTrackConfiguration`, `resetTrackConfiguration`,
`deleteTrackConf`. Repo `CLAUDE.md`'s rule — `addSessionTrackConf` is the
default, `publishTrackConf` only for Add-track workflows — is the policy this
spec's leaf count is the shape of.

## Leaf branches: 32

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
is folded into case C below): **13**. Case A (non-admin editing a track with a
catalog base) — the new delta differs from any existing one (2: does the
programmatic-sync half apply or no-op) × does an *existing* identical delta
already exist so the write is skipped instead of stored (2) = 4, plus nets back
to base and a delta existed (2: `revertWorkingCopy` true vs false, per
`isWorkingCopyState` — the "promoted-default unset" case Session/CLAUDE.md
documents), plus nets back to base with no delta to clear (1 true no-op) = 7.
Case B (non-admin editing their own session track, no catalog base): in-place
replace succeeds, or throws on an invalid config = 2. Case C (admin edit, a
connection track, or a track with neither a base nor a session entry — routed
to the base mixin's `updateTrackConfiguration`): connection-track branch vs
catalog-write branch (2), each independently paired with "a stale delta from a
prior non-admin session gets cleared" or not (2) = 4.

**`resetTrackConfiguration`**: delta present → cleared and the working copy is
always reverted (`revertWorkingCopy` defaults true here, unlike the update
path's conditional); delta absent → no-op. **2**.

**`deleteTrackConf`**: override mixin — `dereferenceTrack` always runs (closes
every open view showing the track), independent of the rest; whether the
catalog entry is removed depends on `adminMode` (2); whether a leftover delta
also gets cleared is independent (2); whether a `sessionTracks` entry gets
spliced out is independent of both (2) — 2×2×2 = **8**, including a leaf the UI
never offers but the action does not guard against: a non-admin "deleting" a
catalog-owned track dereferences every open view and removes nothing from any
store, since it is neither an admin catalog-delete nor a `sessionTracks`
splice.

6 + 1 + 13 + 2 + 8 = **30**, plus 2 more accounted for above inside the
`addSessionTrackConf`/`publishTrackConf` subtotals' "missing type" throws being
genuinely separate code sites in the two mixins (already counted once each
above) — **32** named terminal branches in total.

## What a consumer can tell apart: 17

Two branches are the same *state* when nothing downstream can distinguish
them. The clearest case: Case A's "identical delta, sync applies" and "new
delta, sync applies" write the same eventual `trackConfigDeltas[trackId]` and
leave the working copy in the same place — 4 of the 7 Case-A leaves collapse to
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
9. delta cleared, working copy **not** reverted (the promoted-default-unset
   case — the two are indistinguishable to a `tracks`-getter read and
   distinguishable only to an *open display*, which is exactly the split
   `Session/CLAUDE.md` calls out)
10. true no-op — nothing to clear, nothing changed
11. own `sessionTracks` entry edited in place (silent)
12. own `sessionTracks` entry edit refused — invalid config (error snackbar)
13. admin edit overwrites the catalog base, silently dropping any stale
    non-admin delta if one existed (edited badge, if it was on, goes off)
14. an opened connection track's config is edited in place
15. deleted from `jbrowse.tracks` (admin), views dereferenced
16. deleted from `sessionTracks` (non-admin's own track), views dereferenced
17. dereferenced with nothing removed from any store — the unguarded
    non-admin-delete-of-a-catalog-track leaf above

**17**, not 32: the routing logic's job is almost entirely to pick a
*destination*, and most of the branch count is two or three code paths
reaching the same destination by a different route (dedupe-vs-add,
admin-vs-desktop, sync-applies-vs-not).

## What actually gets read: 4 destinations, plus three small side channels

Nothing downstream reads all 17 outcomes as 17 separate cases. Four consumers,
each asking one narrow question:

- **The `tracks` getter** (what renders): which of {session, catalog,
  delta-merged-over-catalog, connection} a track's live config now comes from.
  **4 values.** This is the axis every one of the 17 outcomes ultimately
  reduces to.
- **`isTrackOverride`** (the edited badge): on or off, computed from
  `flattenTrackConfigDelta`'s *changed-slot* count, not from bare key presence
  in `trackConfigDeltas` — a delta holding only content-free display stubs
  reads as off. **2 values.**
- **The track menu's `isSessionOverride`** (Delete vs "Reset track settings"):
  whether the track has a catalog base at all. **2 values**, and it is asked
  independently of whether that base is currently overridden — a session track
  with no base always offers Delete.
- **The snackbar surface**: none, an invalid-config error, or the
  missing-assembly info notice. **3 values**, and only 2 of the 32 branches
  ever produce a non-none one.

4 × 2 × 2 × 3 = 48 combinatorial slots; the 17 outcomes above occupy 12 of
them, because a "which store" answer of `connection` or `session-track-owned`
never co-occurs with an edited badge (only a catalog-based track can have a
delta), and the snackbar values only ever pair with the session-add and
session-track-edit destinations.

## Verdict

**The shape holds up.** 32 branches sounds like a lot for six actions, but 15
of them exist because the same three-way dedupe-or-write-or-throw pattern
(`addToSession`, and its structural twin inside Case B of
`updateTrackConfiguration`) is walked by hand at four different call sites
instead of shared once — that is code duplication, not state-space growth, and
it collapses cleanly once grouped by destination. The genuine complexity is
real and load-bearing: three destinations exist because a catalog write, a
per-user addition, and a per-user *edit of someone else's* entry are three
different persistence and sharing semantics, and `Session/CLAUDE.md`'s
documented invariants (delta caching keyed to the value it mirrors, the
working-copy-revert conditional) exist because getting any one of them wrong
either loses a keystroke mid-edit or silently undoes an admin's promoted
default. A four-value destination is the honest floor for what this concept
has to express.

**Two findings worth fixing, not smoothing over in the writeup:**

- `jbrowse.addTrackConf` (`packages/app-core/src/JBrowseModel/index.ts`) does
  an **unconditional push with no dedupe**, unlike `addToSession`'s
  `getTrackById` check. A repeated add through the desktop mixin, or an admin
  `publishTrackConf` call that races itself, can push two catalog entries
  sharing one `trackId` — a state `addToSession`'s dedupe exists specifically
  to prevent on the session side. Nothing here validates catalog-side
  uniqueness before the write.
- `deleteTrackConf`'s leaf 17 (a non-admin calling delete on a catalog-owned
  track dereferences every open view and removes nothing from any store) is
  reachable by any caller that does not go through the track menu's
  `isSessionOverride`-gated UI, including a plugin. It is a silent no-op
  standing in for what should be a refusal.
