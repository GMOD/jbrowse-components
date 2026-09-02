---
status: Accepted
summary: 'Enumerating "what is open" was a duck-typed walk of the view nesting copied into four consumers, two of which had drifted onto different container spellings; now each view answers for itself through BaseViewModel''s ownTracks/allViews/allTracks, AppReadyMarker publishes the reduction as data-app-* census attributes, and capture''s session gate reads that one element — the walk survives only as capture''s legacy fallback'
---

# ADR-103: The view answers for itself, and the marker publishes the census

## Status

Accepted

## Context

Four consumers needed "every track open on the session" or "is anything still
loading", and each carried its own duck-typed walk of the view nesting:
`AppReadyMarker`, `jbApi`, and `@jbrowse/capture`'s session gate and busy
check. The nesting is genuinely irregular — an ordinary view holds `tracks`, the
synteny view holds per-band `trackContainers` (raw prop `levels`) and its rows
on `views`, the dotplot holds two 1D *axis* models under a prop also named
`views` — and the copies drifted exactly as expected: the capture gate read
`levels` while the busy check read `trackContainers`, each blind to the other's
spelling, and both worked only because the live model happens to publish both.
[ADR-101](adr-101-readiness-is-answered-three-times-on-purpose.md) already
rejected merging the *logic* across the page boundary (serialization,
dependency direction, version skew) and pointed at strengthening the seam
instead.

## Decision

**Each view answers for itself; the reduced answers are published beside the
phase; only the answers cross the page boundary.**

- `BaseViewModel` derives `ownTracks` (this view's tracks, containers
  included), `allViews` (self plus every nested view, recursively — a `views`
  entry answers only if it carries the contract itself, which is what keeps the
  dotplot's axis models out) and `allTracks`. The walk over
  `tracks`/`trackContainers`/`views` is written exactly once, beside the
  contract it reads. The three are **required** on `AbstractViewModel`, like
  `bodyMounted`: a stand-in that forgets one fails the build instead of
  silently under-reporting.
- `AppReadyMarker` computes from the contract and publishes the census as
  attributes beside `data-app-phase`: `data-app-views` (count),
  `data-app-assemblies` and `data-app-tracks` (JSON string arrays). `jbApi`
  enumerates through the contract too and keeps no copy of the nesting.
- `@jbrowse/capture`'s session gate and summary read the census element first —
  one `querySelector`, no session access — and fall back to the
  `window.JBrowseSession` walk only on a deployed build older than the census.
  That fallback goes when the rest of the legacy chain does.

ADR-101 stands: no logic is shared across the boundary, capture's in-page
functions still declare everything inside themselves, and the strings are the
contract — `scripts/readinessContract.test.ts` pins the census attribute names
the way it pins the phase selector, and
`products/jbrowse-web/src/tests/pluginFacingSessionApi.test.ts` pins the
contract getters on a real session-created view.

## Consequences

- A new container view that implements `trackContainers` (the published slot
  for "lists I own instead of `tracks`") is enumerated everywhere with no
  further work, and a view type that invents a third spelling has exactly one
  place to teach it.
- `jbApi.allViews` now recurses to any depth where it used to flatten one
  level, and no longer sweeps the dotplot's axis models in as views — ADR-101's
  consequence table rows for "nested views" are superseded for jb by this.
- The census makes capture's positive gate marker-only on new builds: it can be
  satisfied before `window.JBrowseSession` is even assigned (the marker commits
  with the app tree; the global lands in a parent effect after it), and it
  keeps working if the session global's shape changes.
- The census reports what the contract reports. A view composing
  `BaseViewModel` is covered by construction; one that does not compose it and
  lacks the getters is invisible to the census — the build-failing interface is
  what makes that loud in-repo, and third-party view plugins pin core versions
  (the v5 line breaks compatibility already).
