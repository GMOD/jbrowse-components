---
status: Accepted
summary: 'Enumerating "what is open" was a duck-typed walk of the view nesting copied into four consumers, two of which had drifted onto different container spellings; now each view DECLARES what it holds as ownTracks/ownViews, openViews/openTracks reduce over that, AppReadyMarker publishes the reduction as data-app-* census attributes, and capture''s session gate reads that one element — the walk survives only as capture''s legacy fallback'
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

- A view **declares** what it puts in the census: `ownTracks` (the tracks it
  holds itself) and `ownViews` (the views nested directly inside it).
  `BaseViewModel` answers both with nothing, and the five views that have
  something override — LGV, circular and dotplot with their `tracks`,
  breakpoint-split with its panels, linear-comparative with its per-band
  containers and its rows. Both are **required** on `AbstractViewModel`, like
  `bodyMounted`, so a stand-in that means to be enumerated says so.
- `util/openViews.ts` holds the recursion over those declarations —
  `openViews(session)` and `openTracks(session)` — so it is still written
  exactly once, which was the point.

**Neither half guesses at the other, and that is the correction.** The first
cut had `BaseViewModel` derive all three by reading `tracks`/`trackContainers`/
`views` off `self` through a duck-typed cast. That put the guess in one place
instead of four, but it also made every view in the ecosystem a participant
without asking, and the census is not a shape that can be discovered:

- react-msaview's view exposes `get tracks()` — its conservation and sequence-
  logo annotation rows, `{ReactComponent, model}` objects with no configuration
  and no displays. The base helped itself to them, the readiness marker read
  `.displays` off one, and every session holding an MSA view error-paged. The
  same would have hit jbrowse-plugin-tview, which composes the same model.
- The dotplot's `views` prop holds its two 1D *axis* models, which carry a
  width and a bpPerPx and are views by every structural test. Only the dotplot
  knows they are not views the user opened.

A sniff test in the base — "has `configuration` and `displays`, must be a
track" — stops the crash and keeps the guess. A declaration removes it.
- `AppReadyMarker` computes from the helpers and publishes the census as
  attributes beside `data-app-phase`: `data-app-views` (count),
  `data-app-assemblies` and `data-app-tracks` (JSON string arrays). `jbApi`
  enumerates through them too and keeps no copy of the nesting.
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

- A new container view is enumerated once it says so, in one getter beside the
  property it reads. That is the cost of the correction: enrolment is no longer
  free, and a view type that invents a third spelling for its children writes a
  third three-line getter rather than teaching one walk about it. Worth it —
  the free version enrolled views that did not want to be enrolled, and the
  failure landed on the whole session rather than on the census.
- `jbApi` now recurses to any depth where it used to flatten one level, and no
  longer sweeps the dotplot's axis models in as views — ADR-101's consequence
  table rows for "nested views" are superseded for jb by this.
- The census makes capture's positive gate marker-only on new builds: it can be
  satisfied before `window.JBrowseSession` is even assigned (the marker commits
  with the app tree; the global lands in a parent effect after it), and it
  keeps working if the session global's shape changes.
- **The declaration found a gap the walk had hidden.** `SvInspectorView` keeps
  its two children on named props — `spreadsheetView` and `circularView` — not
  under `views`, so no spelling of the old walk ever reached them and a
  still-loading circular view inside an SV inspector reads as idle to the
  readiness marker today. Declaring them is two lines, but it has to be gated
  on `showCircularView` or an unshown, uninitialised circular view parks
  `data-app-phase` at `loading` forever, so it is a behaviour change with its
  own test rather than part of this one. Left as it was; filed here.

- The census reports what the views declare, so a view that declares nothing is
  invisible to it — including a plugin view built against a core older than the
  getters, which `openViews` tolerates with `?? []` rather than throwing. That
  is the failure mode chosen on purpose: under-reporting costs a census entry,
  and the alternative cost a session. The build-failing interface is what keeps
  it loud in-repo.
