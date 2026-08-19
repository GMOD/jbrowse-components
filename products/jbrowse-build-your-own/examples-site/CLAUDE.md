# examples-site

Shared doctrine for all four sites:
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).
Local to this one:

The published package an example may import from is
`@jbrowse/react-linear-genome-view2`, plus the other published packages that doc
names. This site is where the no-shared-helpers rule was learned.

## `check-duplication.mjs` holds the copy-paste rule up from both sides

Run by `pnpm check-links`, unique to this site. Two questions:

**Are the copies identical?** Two top-level blocks with the same name must match
once comments are stripped — the cost of the rule is drift, and the file that
gets missed is a page teaching a bug with nothing to say so. A block that
genuinely differs per page goes in `DIVERGES` **with a reason**.

**Should the copies exist?** A block in `COPY_THRESHOLD` (3) files or more needs
a `COPIED` entry saying why it is the reader's own to write. Choosing between
the two fixes _is_ the check:

- the reader would write it anyway — their box, their track config — so add the
  entry.
- the reader would _have_ to write it because JBrowse publishes no equivalent.
  That is a missing export (`usePanZoom` was eight hand-rolled copies).

Deliberately **not** a redundant-line budget: adding a page adds copies, which
is the rule working. The line total is printed for the trend and gates nothing.

**It only sees named top-level declarations, so behaviour that repeats has to be
given a name.** Repeated inline JSX is invisible to both halves — the
most-repeated thing here was a pan/zoom container div in 13 files, one of whose
four style properties was `touchAction: 'none'`, whose absence makes the demo
inert on a phone, silently. Naming it as `viewport` is what made it visible;
`usePanZoom` writes that property itself now, so the constant is down to three.
When a styled div reaches a fifth example, name it there rather than reading a
green run as coverage.

Keep both lists short. If either grows, the shared surface has outgrown
copy-paste and the answer is a different rule argued here, not more entries.

**A green run says the copies agree, never that they are right.** Fourteen of
fifteen `TrackRow`s mounted `RenderingComponent` in a bare `contain: strict`
box, which is the display's own stacking context — so `TrackOverlayPortal` found
no host node, fell back to rendering inline, and left every display's corner
controls, colour key, loading scrim and error bar under whatever the page
painted over the stack. All fourteen were character-identical, so this file was
silent; the fifteenth, `TrackSettings`, hit it and worked around it under a
second name, and that name is what kept the rest from reading as wrong. When a
block is renamed rather than fixed, the drift check stops being able to see the
question.

So the third question to ask of a copied block is whether it omits half of a
contract JBrowse publishes. `everyDisplayIsInAnOverlaySlot` in `smoke.mjs` is
that one, made measurable.

## Three measured claims, and the first two are ratchets

**`smoke.mjs` holds the evidence for this site's central claim**: `MUI_BUDGET`
counts `Mui*`-classed elements and `muiThemedStyling` counts elements whose font
came from MUI's default theme — the only way to see a `makeStyles` component.
Every page installing `plainChromeOverlays` + `plainTrackControl` scores
**zero** on both. When one fails, the fix is almost never the number: a display
started rendering a Material component behind neither provider, and raising the
budget quietly makes the prose false.

**`MUI_BUDGET` is held at two instants, and the second one is why.** The count
at rest is the obvious half; `recordMuiFromLoad` samples from before the page's
own scripts run and holds the _union_ to the same number. Everything else here
runs once the page is quiet, and quiet means nothing is loading — so a component
that exists only while something is fetching was structurally unreachable. That
is not a hypothetical: `synteny` scored zero for as long as it existed while
drawing a `MuiLinearProgress` on every visit, from `ComparativeFetchStatus`,
which was then behind neither provider. **So a failure naming only the "ever"
number is the interesting one** — it means the page is clean by the time you
look at it, which is exactly why nobody had.

**`everyDisplayIsInAnOverlaySlot` is the third, and it is a contract rather than
a number.** Every `[data-display-id]` must sit inside a
`[data-track-overlay-slot]`, because a display's floating chrome escapes its
`contain: strict` sandbox through `TrackOverlayPortal` and the host mounts the
node it lands in. Two markers and one `closest()`, deliberately, rather than a
list of the chrome to look for: such a list goes stale the next time a display
grows a piece, and a stale list reads as a clean run. The display count is the
floor — a page that mounted nothing fails rather than passing by having nothing
to examine.

Ask the mechanism here, not the symptom. Whether a seam happens to be over the
corner control right now depends on the demo's data and its zoom, which is why
this shipped broken on fourteen pages under a full green board.

**A branch every copy renders can still be unreachable.** Every `ViewStatus` on
this site has a `noRegions` arm, and for as long as all eighteen
`createViewState` calls here passed `init`, no page could reach one — including
the page whose whole argument for `view.status` over `view.ready` _is_ that
state. The copies were right, the drift check was green, and the thing being
taught had no demo anywhere. `loading-and-errors` now builds one engine with no
`init`, and `viewStatusStatesAreDrawn` drives both ends of it: the state has to
be drawn, and `setInit` has to get back out of it. When a demo's own prose names
a case, grep the site for an input that produces it before believing the case is
shown.

**`eagerBundleSizes.json`** is written by `pnpm measure-eager-bundle` and
re-checked by `pnpm smoke`. Going **under** a budget fails as well as over —
bank the win by re-running and committing, or the next change spends it quietly.

Two things to check before hunting an import, both in
`agent-docs/reference/EAGER_BUNDLE.md`: **was a page added or removed** (budgets
are coupled, ~13 KB gzip a page), and **is it a shared React-free module** (one
imported by both an eager and a lazy module gets grouped with the lazy chunk, so
the eager import pays for the whole chunk). That, not a component import, is
what both regressions have been.

## `pnpm probe-eager-graph` answers _why_, and is the one to reach for first

`measure-eager-bundle` gives a number; this gives the modules behind it, by
intersecting the pre-treeshake source graph with the post-treeshake chunks — so
"is statically reachable" becomes "is actually paid for".

    pnpm probe-eager-graph                                costliest eager modules
    pnpm probe-eager-graph --holds @mui/material/styles   who is keeping it here
    pnpm probe-eager-graph --no-build                     reuse the last dump

Two traps are wired in rather than left as advice: it attributes at module
level, never by chunk name (a rolldown chunk is named after one of its modules
and holds unrelated ones); and when nothing first-party names the target
directly it falls back to the package's barrel importers.

Every run also prints **how much of the eager set the page's own static graph
reaches**, which is the figure to quote when a budget moved and you need to know
whether this page's imports did. It barely moves when a neighbouring page is
added (0.6%, against gzip's 2.3%) — see "the noise is larger than the band" in
EAGER_BUNDLE.md, which also says why it is uncompressed and why the per-page
figures do not sum to the site.

The probe build overwrites `dist/` — re-run `pnpm build` before trusting a
measurement taken after it. The chrome bundle figures in the prose come from the
repo-root `scripts/measureChromeBundle.ts`.
