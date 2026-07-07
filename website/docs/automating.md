---
title: Automating JBrowse
sidebar_label: Automating JBrowse
description: Launch and preset views from a URL, embedded app, config file, or session spec
---

JBrowse is designed to be driven from the outside: you can open it straight into
a specific assembly, location, and set of tracks — from a URL link, an embedded
app, a config file, or a saved session spec. All of these funnel into one `init`
spec that controls what a view shows — assembly, location, tracks, highlights,
and so on. This page covers those fields and links to the detailed reference for
each surface.

:::note

This page covers launching and presetting **views**. For headless static-image
export see [@jbrowse/img](/docs/jbrowse-img); for the Python/notebook API see
[JBrowse Jupyter](/docs/jbrowse_jupyter).

:::

## The `init` fields

```typescript
{
  assembly: string        // required: assembly name
  loc?: string            // initial location, e.g. 'chr1:1,000-2,000'
                          //   (omit to show the whole genome)
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

`init` is applied **once**, when the view attaches, and then cleared — it is a
launch instruction, not persistent state, so a saved session never retains it.

## Ways to automate a view

| You are…                                  | Use                                            | Reference                                                     |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Linking to JBrowse Web with a location    | **URL query parameters**                       | [URL query parameter API](/docs/urlparams)                    |
| Embedding a view in your own web page/app | **`createViewState({ location, … })`**         | [Embedding JBrowse](/docs/tutorials/embed_linear_genome_view) |
| Shipping a preset view in a config file   | **`defaultSession`** in config.json            | [Default session](/docs/config_guides/default_session)        |
| Programmatically opening a preset session | **a session spec** (`init` in a view snapshot) | [URL params → session spec](/docs/urlparams)                  |

All four resolve to the same `init` fields above and run the same code path, so
behavior (navigation, track opening, highlighting, the loading spinner) is
identical regardless of how you launched.

## URL parameters

JBrowse Web maps query parameters straight onto `init`:

```
?assembly=hg19&loc=chr1:1,000-2,000&tracks=genes,variants&tracklist=true&nav=false&highlight=chr1:1,500-1,600
```

See [URL query parameter API](/docs/urlparams) for every parameter, session
specs for all view types, and shareable/encoded sessions.

:::note

Embedded components (`@jbrowse/react-linear-genome-view2`,
`@jbrowse/react-app2`) make no assumptions about URL parameters — that logic is
up to the host application.

:::

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
views each accept their own `init`/session-spec shape with the same
"applied-once-on-launch" lifecycle. Their fields are documented per view type in
the [URL query parameter API](/docs/urlparams) session-spec section.

## Headless / puppeteer

When you want a **static image** of a view, reach for
[@jbrowse/img](/docs/jbrowse-img) first — it renders SVG/PNG/PDF from the command
line without a browser.

Drive the full JBrowse Web app with puppeteer (or Playwright) when you need
something `img` can't produce: a real screenshot of the running UI, a transient
state (an open menu, a hover popover, a loaded track after user interaction), or
scraped DOM. Because every launch surface above resolves to the same `init`,
automating a browser is just "navigate to a URL that carries the state, wait for
it to settle, then act".

Two things bite people driving JBrowse headlessly, both worth knowing up front:

- **WebGL/WebGPU needs a software renderer in headless Chrome.** JBrowse renders
  tracks on the GPU, and headless Chrome has no GPU — without
  `--enable-unsafe-swiftshader`, canvases come up blank. Launch with
  `args: ['--no-sandbox', '--enable-unsafe-swiftshader']`.
- **"Loaded" is a specific signal, not a guessable selector.** JBrowse shows a
  `[data-testid="loading-overlay"]` while the session initializes, and each track
  display flips its `data-testid` from `display-<id>` to `display-<id>-done` once
  it has actually painted. Wait for those, not for an arbitrary element.

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
    '&assembly=hg19&loc=chr1:1,000,000-2,000,000&tracks=genes,variants&nav=false',
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
full session spec rather than individual params — see the session-spec section
of the [URL query parameter API](/docs/urlparams).

This repo's own screenshot generator does all of this and handles the sharper
edges — freezing CSS animations so menus/popovers aren't caught mid-transition,
double-`requestAnimationFrame` before capture so a freshly-composited GPU layer
is actually rasterized, and a fresh browser per navigation to sidestep
service-worker caching. For a complete worked example, see
[`website/scripts/generate-screenshots.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/generate-screenshots.ts)
and the reusable wait helpers (`waitForLoadingComplete`, `waitForDisplaysDone`,
`waitForQuiescent`) it imports from
[`packages/browser-test-utils`](https://github.com/GMOD/jbrowse-components/tree/main/packages/browser-test-utils).

## See also

- [Embedded components](/docs/embedded_components) — choosing a package before
  wiring up `init`
- [Default session](/docs/config_guides/default_session) — the config-file
  equivalent of shipping an `init` block
- [URL query parameter API](/docs/urlparams) — full parameter and session-spec
  reference for every view type
