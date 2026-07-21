---
title: Automating JBrowse
sidebar_label: Automating JBrowse
description:
  Launch and preset views from a URL, embedded app, config file, or session spec
---

You can open JBrowse directly into a specific assembly, location, and set of
tracks from a URL link, an embedded app, a config file, or a saved session spec.
Each of these populates the same `init` object on a view, which sets the
assembly, location, tracks, and highlights it shows. This page describes those
fields and links to the reference for each one.

This page covers launching and presetting views. For headless static-image
export see [@jbrowse/img](/docs/jbrowse-img); for the Python/notebook API see
[JBrowse Jupyter](/docs/jbrowse_jupyter).

## The `init` fields

```typescript
{
  assembly: string        // required: assembly name
  loc?: string            // initial location, e.g. 'chr1:1,000-2,000' (omit loc to show the whole genome)
  tracks?: TrackInit[]    // tracks to open (id strings, or objects — see below)
  tracklist?: boolean     // open the track selector drawer (default: false)
  nav?: boolean           // show the navigation header (default: true)
  highlight?: string[]    // regions to highlight
}
```

A `TrackInit` is either a track id string, or an object that also sets initial
display options:

```typescript
{
  trackId: string
  trackSnapshot?: object   // overrides on the track
  displaySnapshot?: object // overrides on the display, e.g. { height: 250 }
}
```

`init` is applied once when the view attaches, then cleared. It is a launch
instruction rather than persistent state, so a saved session never retains it.

## Ways to automate a view

- Link to JBrowse Web at a location with
  [URL query parameters](/docs/urlparams).
- Embed a view in your own page or app by passing `location` (and related
  fields) to `createViewState`, see
  [Embedding JBrowse](/docs/tutorials/embed_linear_genome_view).
- Ship a preset view in a config file with a `defaultSession` in config.json,
  see [Default session](/docs/config_guides/default_session).
- Open a preset session programmatically with a session spec, which is an `init`
  block inside a view snapshot, see
  [URL params → session spec](/docs/urlparams).

All of these set the same `init` fields, so navigation, track opening, and
highlighting behave the same way whichever one you use.

## URL parameters

JBrowse Web maps query parameters straight onto `init`:

```
?assembly=hg19&loc=chr1:1,000-2,000&tracks=genes,variants&tracklist=true&nav=false&highlight=chr1:1,500-1,600
```

See [URL query parameter API](/docs/urlparams) for every parameter, session
specs for all view types, and shareable/encoded sessions.

Embedded components (`@jbrowse/react-linear-genome-view2`,
`@jbrowse/react-app2`) make no assumptions about URL parameters. That logic is
up to the host application.

## Embedded components (`createViewState`)

`createViewState` accepts `location` and `highlight` and routes them through
`init`, so an embedded view shows the loading spinner (not the import form)
while the assembly loads:

```js
const state = createViewState({
  assembly,
  tracks,
  location: 'chr1:1,000-2,000',
  highlight: ['chr1:1,500-1,600'],
})
```

For full track control at launch, provide a `defaultSession` whose view carries
an `init` object. See
[Embedding JBrowse](/docs/tutorials/embed_linear_genome_view).

## Config / session files

A `defaultSession` in config.json (or any session snapshot) can give a view an
`init` block:

```json
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

See [Default session](/docs/config_guides/default_session).

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
[URL query parameter API](/docs/urlparams) session-spec section.

## Headless / puppeteer

When you want a static image of a view, reach for
[@jbrowse/img](/docs/jbrowse-img) first, as it renders SVG/PNG/PDF from the
command line without a browser.

Drive the full JBrowse Web app with puppeteer (or Playwright) when you need
something `img` can't produce: a real screenshot of the running UI, a transient
state (an open menu, a hover popover, a loaded track after user interaction), or
scraped DOM. Since the URL parameters above set the initial state, the pattern
is to navigate to a URL carrying that state, wait for it to settle, then act.

Two things commonly trip people up when driving JBrowse headlessly.

The first is GPU rendering. JBrowse renders tracks on the GPU, and headless
Chrome has no GPU, so canvases come up blank without a software renderer. Launch
with `args: ['--no-sandbox', '--enable-unsafe-swiftshader']`.

The second is knowing when a view has finished loading. JBrowse shows a
`[data-testid="loading-overlay"]` while the session initializes, and each track
display changes its `data-testid` from `display-<id>` to `display-<id>-done`
once it has painted. Wait for those rather than an arbitrary element.

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

// session done initializing: the loading overlay is gone
await page.waitForFunction(
  () => !document.querySelector('[data-testid="loading-overlay"]'),
)
// every track display has painted (testid ends in "-done")
await page.waitForFunction(() => {
  const displays = document.querySelectorAll('[data-testid^="display-"]')
  const done = document.querySelectorAll('[data-testid$="-done"]')
  return displays.length > 0 && done.length === displays.length
})

await page.screenshot({ path: 'view.png' })
await browser.close()
```

For a longer-form session (multiple views, per-track display options) encode a
full session spec rather than individual params. See the session-spec section of
the [URL query parameter API](/docs/urlparams).

This repo's own screenshot generator does all of this and handles several
finicky details: freezing CSS animations so menus and popovers aren't caught
mid-transition, calling `requestAnimationFrame` twice before capture so a
freshly-composited GPU layer is actually rasterized, and using a fresh browser
per navigation to sidestep service-worker caching. For a complete worked
example, see
[`website/scripts/generate-screenshots.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/generate-screenshots.ts)
and the reusable wait helpers (`waitForLoadingComplete`, `waitForDisplaysDone`,
`waitForQuiescent`) it imports from
[`packages/browser-test-utils`](https://github.com/GMOD/jbrowse-components/tree/main/packages/browser-test-utils).

## See also

- [Embedded components](/docs/embedded_components)
- [Default session](/docs/config_guides/default_session)
- [URL query parameter API](/docs/urlparams)
