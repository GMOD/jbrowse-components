---
title: Automating JBrowse
sidebar_label: Automating JBrowse
description:
  Launch and preset views from a URL, embedded app, config file, or session spec
---

You can open JBrowse directly into a specific assembly, location, and set of
tracks from a URL link, an embedded app, a config file, or a saved session spec.
Each of these populates the same `init` object on a view, which sets the
assembly, location, tracks, and highlights it shows.

For headless static-image export see [@jbrowse/img](/docs/jbrowse-img); for
screenshotting a real running instance see [](/docs/agents_capture); for the
Python/notebook API see [](/docs/jbrowse_anywidget). If a coding agent is doing
the automating, start at [](/docs/agents).

## The `init` fields

`InitState` is the set below. Beneath it is `LinearGenomeViewLaunchProps`, the
other half of what a launch may set: every plain view property, derived from the
model, so a setting you can reach from a menu is generally settable at launch
too.

<!-- include: plugins/linear-genome-view/src/LinearGenomeView/types.ts#initState -->

```typescript
export interface InitState {
  /**
   * A locstring, or several separated by spaces to open a discontinuous view:
   * `'chr3:25,325,000-25,361,000 chr10:58,716,500-58,718,500'`. Multiple
   * regions are the only declarative way to frame something spread across loci
   * (a derivative allele against its sources, a gene's partners in a fusion) --
   * `displayedRegionNames` takes whole chromosomes, not intervals.
   */
  loc?: string
  // fractional zoom-out applied around `loc` for context (passed to
  // navToLocString's `grow`), e.g. 0.2 pads a region by 20% on each side.
  // Ignored without `loc`.
  grow?: number
  assembly: string
  // restrict a whole-genome view to these assembly refNames (whole
  // chromosomes), in the order given — e.g. the main chromosomes without the
  // unplaced/alt contigs. Names resolve through the assembly's aliases. Ignored
  // when `loc` is set (which navigates to a single region instead).
  displayedRegionNames?: string[]
  tracks?: TrackInit[]
  tracklist?: boolean
  nav?: boolean
  // a string entry is a locstring or a JSON-encoded HighlightType (the URL
  // wire-format); programmatic callers (createViewState/session JSON) can pass
  // a HighlightType object directly
  highlight?: (string | HighlightType)[]
}

// Plain persisted view props a launch spec may set inline alongside init keys.
// Unlike InitState these need no resolution — LaunchView forwards them straight
// onto the view snapshot, where MST restores and validates them natively.
//
// EVERY declared property of the view, derived, minus the init keys (which mean
// something else here: `tracks` is trackIds to open, not built track models)
// and the view's identity. Nothing is listed, so a property is settable from a
// spec — and type-checked — from the line that declares it.
//
// It used to be a hand-written eight, and the model has grown past it:
// `hideHeader`, `hideHeaderOverview`, `hideNoTracksActive`, `labelsVisible`,
// `scalebarOnly`, `showCytobands`, `showGridlines` and `showTrackOutlines` were
// all declared, all settable from the menu, and all dropped in silence by a
// spec that named them — which is most of what a figure or an embed wants to
// say. `partitionLaunchKeys` reads the same set off the model at runtime.
export type LinearGenomeViewLaunchProps = Partial<
  Omit<
    SnapshotIn<LinearGenomeViewStateModel>,
    keyof InitState | 'id' | 'type' | 'init'
  >
>
```

`loc` takes several whitespace-separated locstrings
(`'chr3:25,325,000-25,361,000 chr10:58,716,500-58,718,500'`) to open a
discontinuous view of all of them; `displayedRegionNames` takes whole
chromosomes, and is ignored when `loc` is set. `grow` needs a `loc` to expand.

A `TrackInit` is either a track id string, or an object that also sets initial
display options:

<!-- include: packages/core/src/util/tracks.ts#trackInit -->

```typescript
export type TrackInit =
  | string
  | {
      trackId: string
      // rarely-needed escape hatches: `trackSnapshot` applies to the track
      // config node, `displaySnapshot` explicitly to the display node. Any
      // OTHER key on this object is treated as a display-snapshot prop, so the
      // common case sets display options inline with no nesting:
      // `{ trackId, showDescriptions: false }` rather than
      // `{ trackId, displaySnapshot: { showDescriptions: false } }`.
      trackSnapshot?: Record<string, unknown>
      displaySnapshot?: Record<string, unknown>
      [key: string]: unknown
    }
```

Any other key on that object is folded into the display snapshot, so
`{ trackId, height: 250 }` is the shorthand for the nested form above.

`init` is applied once when the view attaches, then cleared, so a saved session
never retains it.

## Ways to automate a view

- Link to JBrowse Web at a location with
  [URL query parameters](/docs/urlparams).
- Embed a view in your own page or app by passing `location` (and related
  fields) to `createViewState`, see
  [](/docs/tutorials/embed_linear_genome_view).
- Ship a preset view in a config file with a `defaultSession` in config.json,
  see [](/docs/config_guides/default_session).
- Open a preset session programmatically with a session spec, which lists these
  same fields flat on each view, see
  [URL params → session spec](/docs/urlparams).

## URL parameters

JBrowse Web maps query parameters straight onto `init`:

```
?assembly=hg19&loc=chr1:1,000-2,000&tracks=genes,variants&tracklist=true&nav=false&highlight=chr1:1,500-1,600
```

See [](/docs/urlparams) for every parameter, session specs for all view types,
and shareable/encoded sessions.

Embedded components (`@jbrowse/react-linear-genome-view2`,
`@jbrowse/react-app2`) make no assumptions about URL parameters; that logic is
up to the host application.

## Embedded components (`createViewState`)

`createViewState` accepts `location` and `highlight` and routes them through
`init`, so an embedded view shows the loading spinner while the assembly loads:

```js
const state = createViewState({
  assembly,
  tracks,
  location: 'chr1:1,000-2,000',
  highlight: ['chr1:1,500-1,600'],
})
```

For full track control at launch, provide a `defaultSession` whose view carries
an `init` object. See [](/docs/tutorials/embed_linear_genome_view).

## Config / session files

A `defaultSession` in config.json (or any session snapshot) can give a view an
`init` block:

```json session
{
  "defaultSession": {
    "name": "My session",
    "views": [
      {
        "type": "LinearGenomeView",
        "init": {
          "assembly": "hg19",
          "loc": "chr1:1,000,000-2,000,000",
          "tracks": ["genes", "variants"]
        }
      }
    ]
  }
}
```

Here `init` is required: a `defaultSession` view is a saved state snapshot, and
`init` is the property holding the keys that need resolving on load. Which key
goes where:

- **Inside `init`** — `loc`, `tracks`, `highlight`, `tracklist`, `nav`,
  `displayedRegionNames`, `grow`.
- **Beside `init`** — plain view settings, which are properties in their own
  right: `colorByCDS`, `showAminoAcids`, `showCenterLine`, `trackLabels`,
  `showHighlightChips`.

A [session spec](/docs/urlparams#session-spec) lists the same keys flat instead,
since there they are arguments to the view's launcher, so a view moved between
the two has to be reshaped.

See [](/docs/config_guides/default_session).

## Highlights

A `highlight` entry can be a plain locstring (`chr1:1,000-2,000`) or, when you
need a custom color or label, a JSON object:

```
{"refName":"chr1","start":1000,"end":2000,"color":"#ff000055","label":"my region"}
```

In a URL, `highlight` is space-separated and the JSON form must not contain
spaces (a space inside a label is split apart); the JSON form is most reliable
for programmatic `createViewState`/session-JSON launches. See the
[`&highlight=` reference](/docs/urlparams) for details.

## Other view types

Circular, dotplot, synteny, spreadsheet, breakpoint-split, and SV-inspector
views each accept their own `init`/session-spec shape, applied once on launch in
the same way. Their fields are documented per view type in the
[](/docs/urlparams) session-spec section.

## Headless / puppeteer

When you want a static image of a view, reach for
[@jbrowse/img](/docs/jbrowse-img) first, as it renders SVG/PNG/PDF from the
command line without a browser.

Drive the full JBrowse Web app with puppeteer (or Playwright) for a real
screenshot of the running UI, a transient state (an open menu, a hover popover,
a loaded track after user interaction), or scraped DOM. The URL parameters above
set the initial state, so the pattern is to navigate to a URL carrying that
state, wait for it to settle, then act.

Three things commonly trip people up when driving JBrowse headlessly.

- **GPU rendering.** JBrowse renders tracks on the GPU, and headless Chrome has
  no GPU, so canvases come up blank without a software renderer. Launch with
  `args: ['--no-sandbox', '--enable-unsafe-swiftshader']`.
- **Knowing when a view has finished loading.** JBrowse publishes its own state
  onto the DOM for exactly this: a view carries `data-view-phase="loading"`
  while it is still waiting on its assembly (or on `init`'s navigation) and has
  mounted no displays yet, and each track display carries
  `data-display-phase="loading"` for the whole of its fetch. Waiting until
  neither is present reads the app's own state. Key the wait on those
  attributes: the loading overlay keeps the literal `Loading…` in the DOM behind
  `opacity: 0`, so a text scan needs a computed-style check on top.
- **`screenshot({ fullPage: true })`.** Puppeteer implements it by resizing the
  viewport to the scroll size and restoring it afterwards, and that resize
  invalidates the page raster, so on a loaded machine the capture can come back
  before the content has redrawn: app chrome around a white, empty content area.
  JBrowse fills the window and does not scroll the page, so a plain
  `page.screenshot()` already captures the whole app. Set a taller viewport if
  you want a taller image.

```js
import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
// deviceScaleFactor 2 gives a crisp, retina-resolution capture
await page.setViewport({ width: 1500, height: 800, deviceScaleFactor: 2 })

// the same URL params documented above put the view into the desired state
await page.goto(
  'https://jbrowse.org/code/jb2/main/?config=test_data/config.json' +
    '&assembly=hg19&loc=chr1:1,000,000-2,000,000&tracks=ncbi_gff_hg19,clinvar_hg19&nav=false',
  { waitUntil: 'networkidle0' },
)

// every view has its assembly and has mounted its displays
await page.waitForFunction(
  () => !document.querySelector('[data-view-phase="loading"]'),
)
// every track display has finished fetching and drawing
await page.waitForFunction(
  () => !document.querySelector('[data-display-phase="loading"]'),
)

await page.screenshot({ path: 'view.png' })
await browser.close()
```

The waits return as soon as a display is finished rather than pending, so they
will not tell you a capture came out empty: check the frame, or assert on
something the data itself produces.

Two of the terminal states replace the display's whole subtree rather than
overlaying it, and so publish no `data-display-phase` at all: "too large", and a
rendering-backend failure. An ordinary fetch error is an overlay on the still
mounted canvas, and does publish `error`. The waits above are unaffected — none
of the three is `loading` — but a census over `[data-display-phase]` counts the
first two as absent, not as terminal.

For a longer-form session (multiple views, per-track display options) encode a
full session spec rather than individual params. See the session-spec section of
the [](/docs/urlparams).

Nearly every figure on this documentation site is produced this way. Each one is
a declarative spec in
[`website/scripts/screenshot-specs.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/screenshot-specs.ts)
that names a config, a session, and what to wait for, and the generator turns it
into the committed PNG the docs embed. That is also why most figures carry an
"Open this view in JBrowse" link: the image and the link come from the same
spec, so a figure can't drift from the app it depicts.

That generator does everything above and handles several finicky details:
freezing CSS animations so menus and popovers aren't caught mid-transition,
calling `requestAnimationFrame` twice before capture so a freshly-composited GPU
layer is actually rasterized, and using a fresh browser per navigation to
sidestep service-worker caching. For a complete worked example, see
[`website/scripts/generate-screenshots.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/generate-screenshots.ts)
and the reusable wait helpers (`waitForViewPhases`, `waitForDisplayPhases`,
`waitForDisplaysDone`, `waitForLoadingComplete`, `waitForQuiescent`) it imports
from
[`packages/browser-test-utils`](https://github.com/GMOD/jbrowse-components/tree/main/packages/browser-test-utils).

## See also

- [](/docs/config_and_session_json)
- [](/docs/embedded_components)
- [](/docs/config_guides/default_session)
- [](/docs/urlparams)
