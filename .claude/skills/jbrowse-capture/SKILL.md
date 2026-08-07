---
name: jbrowse-capture
description:
  Use when you need to see a JBrowse view rather than just build one —
  screenshot a genome browser, render a figure, check that a config you wrote
  actually shows data, drive JBrowse with Puppeteer, or automate clicking
  through the app. Covers the two capture tools and, above all, how to know the
  browser has finished rendering, which is the part that silently produces
  pictures of empty browsers.
---

# Capturing a JBrowse view

A config that validates can still show nothing: an unindexed file, a refName
mismatch (`chr1` vs `1`), a region with no data. None of those has an exit code.
Looking at the result is the only check that catches them, so take the picture
and then **read it**.

## Pick the tool

|        | `@jbrowse/img`                | `@jbrowse/capture`                              |
| ------ | ----------------------------- | ----------------------------------------------- |
| how    | server-side React, no browser | Puppeteer against a real instance               |
| output | SVG or PNG                    | PNG                                             |
| cost   | fast                          | launches Chromium                               |
| shows  | the tracks                    | the whole app: chrome, menus, dialogs, ideogram |
| covers | the SVG-export path           | canvas / WebGPU rendering, as a user sees it    |

Default to `@jbrowse/img`. Use `@jbrowse/capture` when the answer needs the real
application: a canvas-rendered display, a view type the static exporter does not
cover, a menu or dialog, or reading state back out of a running session.

```bash
npx @jbrowse/img --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 --out out.png
npx @jbrowse/capture --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 -o out.png
```

Both take `--hub` (a hosted assembly), `--config <url>`, `--loc` (locstring, or
a gene name where the config has a text index), and repeatable `--track`.
`npx @jbrowse/capture --help` for the rest; `--session <file.json>` takes a
whole session spec.

## The one thing that goes wrong

**Every readiness signal JBrowse publishes is negative** — no loading overlay,
no display in its loading phase, no unpainted canvas — so all of them pass on a
page whose app has not started yet. The order of events is:

```
navigation resolves -> session exists -> assembly and tracks land -> loading overlay goes up -> displays draw
```

Waiting only on the negative signals is satisfied at the **first** arrow. The
script finishes in about a second, exits 0, and writes a photograph of an empty
browser. `networkidle` does not help: it fires before the session is built, and
an app streaming track data may never go idle.

If you are writing your own Puppeteer script rather than using the CLI, the fix
is a **positive gate** first — jbrowse-web publishes its live session model as
`window.JBrowseSession`:

```js
await page.waitForFunction(
  (assembly, trackIds) => {
    const views = window.JBrowseSession?.views
    if (!views?.length || views.some(v => v.initialized === false)) return false
    if (!views.some(v => (v.assemblyNames ?? []).includes(assembly)))
      return false
    const open = new Set(
      views.flatMap(v => v.tracks.map(t => t.configuration.trackId)),
    )
    return trackIds.every(id => open.has(id))
  },
  { timeout: 60000, polling: 250 },
  'hg38',
  ['hg38-ncbiRefSeqCurated'],
)
```

A 404ing config URL, a trackId the config does not define, and a wrong assembly
name all fail there and nowhere else.

Then the negative signals, in this order — each is only meaningful once the
previous has passed:

| Wait until absent                 | Means                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `[data-view-phase="loading"]`     | no view still resolving its assembly (until then it has mounted no displays and every row below is silent)     |
| `[data-view-component-pending]`   | no view still waiting on its lazy React component                                                              |
| `[data-testid="loading-overlay"]` | no track still fetching                                                                                        |
| `[data-display-phase="loading"]`  | no display still in its own fetch                                                                              |
| `[data-display-drawn="false"]`    | every display has painted — flips on FIRST paint, so it proves nothing until the fetch rows above have cleared |

These attributes are absent on older deployments, which publish only the loading
overlay; there the display rows are unfalsifiable rather than satisfied, and a
bounded settle is all you have.

## Use the library instead

`@jbrowse/capture` is all of the above, done:

```js
import {
  captureJBrowse,
  openJBrowse,
  waitForJBrowseReady,
} from '@jbrowse/capture'

// launch, wait, shoot, close
const { pending, paintContract } = await captureJBrowse({
  hub: 'hg38',
  loc: 'BRCA1',
  tracks: ['hg38-ncbiRefSeqCurated'],
  out: 'brca1.png',
})

// or keep the page to interact with it
const { browser, page } = await openJBrowse({ hub: 'mm39', loc: 'Sox2' })
await page.click('[data-testid="track_menu_icon"]')
await page.screenshot({ path: 'menu.png' })
await browser.close()
```

`waitForJBrowseReady(page)` is the wait alone, for a page you navigated
yourself.

**A stage that times out throws** rather than handing back a half-drawn frame,
naming which gate it was. Pass `allowUnsettled` / `--allowUnsettled` if you
actually want the frame as it stands.

**Read the return fields before trusting the image.** `unsettled` lists stages
that timed out; `pending` lists displays still unpainted at capture time;
`paintContract` is false when the build could not report that at all, so an
empty `pending` there means "cannot tell", not "all done".

## Practical

- Headless Chromium rasterizes in **software**. A view that is slow or dies on
  volume there may be fine on real hardware — do not write a product limit into
  a comment on that basis.
- In a container, pass `--no-sandbox` (the library already does).
- `--scale 2` is the default and is what a figure wants; `--scale 1` for a
  screenshot you only intend to read.
- Raise `--timeout` for a slow remote file, `--settle` for the last repaint.
- Downscale before reading a large PNG:
  `convert out.png -resize 1400x /tmp/shot.png`.

## Reference

- <https://jbrowse.org/jb2/docs/agents_capture.md>
- <https://jbrowse.org/jb2/docs/jbrowse-img.md>
- Related skills: `jbrowse-authoring` (write the config), `jbrowse-hosted-data`
  (data to point it at)
