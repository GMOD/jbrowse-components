# examples-site

Shared doctrine for all four sites:
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).
Local to this one:

An example imports only published packages: `@jbrowse/react-linear-genome-view2`
plus the others that doc names. The mounting, status and chrome blocks every
page needs come from `@jbrowse/display-ui/embed` (`EmbedProvider`, `Track`,
`TrackStack`, `ViewStatus`, `Scalebar`, `RegionSeams`, `Highlights`,
`LocationBox`, `TrackToggle`, `ResizeHandle`, `Legend`), so an example file is
its engine options, its own controls and nothing else. No comments in example
files.

## `check-duplication.mjs` holds the copy-paste rule up from both sides

Run by `pnpm check-links`. Two top-level blocks with the same name must match
once comments are stripped (`DIVERGES` lists exceptions with a reason), and a
block in `COPY_THRESHOLD` (3) files or more needs a `COPIED` entry. Both lists
are empty. When a block starts repeating, the answer is almost always a helper
in `@jbrowse/display-ui/embed` with a jest test, not a list entry: the copies
drift, and fourteen hand-written track mounts once dropped the overlay slot
together.

The check only sees named top-level declarations. Repeated inline JSX is
invisible to it, so a styled box pasted into several pages needs a name before a
green run means anything.

## What `smoke.mjs` measures

**`MUI_BUDGET`** counts `Mui*`-classed elements and `muiThemedStyling` counts
elements styled by MUI's default theme. Every page behind `DisplayUIProvider`
scores zero; `multiple-tracks` is the stock page and keeps its three. When one
fails, the fix is almost never the number: a display started rendering Material
behind neither provider. The budget holds at rest, over everything
`recordMuiFromLoad` saw from before the page's scripts ran (a fetch indicator
exists only while loading), and after the hover sweep (`muiRaisedByHover`), so a
failure naming only the "ever" number is the interesting one.

**`everyDisplayIsInAnOverlaySlot`** requires every `[data-display-id]` inside a
`[data-track-overlay-slot]`, since a display's floating chrome escapes its
`contain: strict` sandbox into that slot. `Track` mounts it; a page that mounts
`RenderingComponent` another way owes it too.

**`placedKeyNamesItsRows`** waits for a row of the data in the `Legend` a page
places outside its track, on the two pages that place one.

**`viewStatusStatesAreDrawn`** drives the loading-and-errors page through the
snackbar, `noRegions` (an engine built with no `view`) and a 404 assembly. When
a demo names a state, check that some input on the site actually reaches it.

**`eagerBundleSizes.json`** is written by `pnpm measure-eager-bundle` and
re-checked by `pnpm smoke`. Going **under** a budget fails as well as over, so
bank a win by re-running and committing. Before hunting an import, check
`agent-docs/reference/EAGER_BUNDLE.md`: whether a page was added or removed
(budgets are coupled, ~13 KB gzip a page), and whether a shared React-free
module got grouped with a lazy chunk.

## `pnpm probe-eager-graph` answers _why_

`measure-eager-bundle` gives a number; this gives the modules behind it, by
intersecting the pre-treeshake source graph with the post-treeshake chunks.

    pnpm probe-eager-graph                                costliest eager modules
    pnpm probe-eager-graph --holds @mui/material/styles   who is keeping it here
    pnpm probe-eager-graph --no-build                     reuse the last dump

It attributes by module, never by chunk name, and falls back to a package's
barrel importers when nothing first-party names the target. Each run prints how
much of the eager set the page's own static graph reaches, the figure to quote
when a budget moved. The probe build overwrites `dist/`, so re-run `pnpm build`
before trusting a later measurement.
