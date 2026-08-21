---
status: Accepted
summary: '`viewTrackConfigs` parked a synthesized track config in a list that outlives the track drawing it, so each of its three call sites grew its own orphan cleanup and one of them silently did not; the config now rides on the track'
---

# ADR-084: A view-local track config rides on its track

## Status

Accepted (2026-08-21). Same genre as
[ADR-069](adr-069-detach-do-not-destroy-what-react-may-hold.md): a thing whose
lifetime is a view's lifetime should not need a separate hook to end it.

## Context

Three launchers synthesize a track nothing outside their own view can draw — the
linear and dotplot read-vs-ref plots, and "Reconstruct derivative allele". The
config names an assembly that exists only for that launch, its adapter is a
`FromConfigAdapter` over features computed from one read, and its trackId carries
a wall-clock stamp so a relaunch cannot collide with a still-open view.

Such a config went into `viewTrackConfigs`, an array on the comparative view
beside `tracks`, and the track referenced it by id. `TrackConfigurationReference`
resolved it with a tree-wide `resolveIdentifier` fallback, since
`session.getTrackById` has never looked in a view.

**A config in a list is not ended by the track that used it going away**, and
every route out of one of those views is a place someone has to remember that:

- `DotplotView.clearView` cleared `viewTrackConfigs` by hand.
- `LinearComparativeView.clearView` did not, and leaked one config per
  return-to-import-form.
- The derivative launcher put its segments track in `session.sessionTracks`
  rather than `viewTrackConfigs` — `showTrack` cannot resolve a view-local id,
  and that was the only list it could reach. Closing the view then took the
  synthetic assembly and left the track, one per launch, in the snapshot the user
  saves and shares.

The third grew a sweep in `releaseTemporaryAssemblies`: on detach, delete every
session track all of whose assemblies are being released. That sweep needed the
view's names intersected with what the session actually held as temporary (half
of every comparative view's list is a permanent assembly, so over the raw list it
deleted the user's own hg38 tracks), an `every` rather than a `some`, a length
guard because `every` is true of nothing, and a copy of the list because
`deleteTrackConf` splices it. Four judgment calls, each a bug if taken the other
way, to undo a decision made in the launcher.

## Decision

**`viewTrackConfigs` is removed. A view-local track config is written into the
track's `configuration`, not referenced by id from a sibling list.**

`TrackConfigurationReference` is a union of "id string" and "full config" — the
second branch already existed for `CircularView.addTrackConf` and
`SvInspectorView`, which push synthesized configs the same way. Taking that
branch makes the config a child of the track node, so:

- closing the track ends the config, and closing the view ends both;
- the config travels inside the view's own snapshot, so a saved session restores
  it as one thing rather than two that can be dropped independently;
- `session.getTrackById` does not resolve it, which is correct — a per-launch
  synthetic belongs in no track selector.

`showTrackGeneric` grew a caller for its `inlineConf` parameter, which existed
unused: a track opened by an action rather than declared in a view snapshot
passes its config there. `LinearGenomeView.showTrack` forwards it.

## Consequences

Deleted: the `viewTrackConfigs` property on `LinearComparativeView` and
`DotplotView`, the `resolveIdentifier` fallback in
`TrackConfigurationReference`, the hand-written clear in `DotplotView.clearView`,
the session-track sweep and its four judgment calls in
`releaseTemporaryAssemblies`, and the launcher's choice between
`addTrackConf` and `addSessionTrackConf` — it now reaches neither.

`releaseTemporaryAssemblies` is back to what its name says: the assemblies, and
nothing else. Its `beforeDetach`/`beforeDestroy`/`hasParent` shape stays, because
an assembly genuinely does live in the session.

An embedded session with `disableAddTracks` now gets the derivative
reconstruction *with* its segment labels. It previously got the view without
them, because the only destination the launcher had was a session list that such
a session refuses.

The capability given up: two track instances can no longer share one view-local
config, which `resolveIdentifier` allowed. No launcher did it, and none of these
tracks appears in a selector that could open a second copy.

`products/jbrowse-web/src/tests/viewTeardown.test.tsx` pins the invariant — the
config resolves off the track, appears in no session list, survives a snapshot,
and is gone after `removeView`. `ReadVsRef.test.tsx` and `SVInspector.test.tsx`
remain the canaries for the union branch itself.
