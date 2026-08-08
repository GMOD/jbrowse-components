---
title: Capturing a JBrowse view from a script
sidebar_label: Screenshots
description:
  Render a view to an image from the command line, or drive the real app with
  Puppeteer, and know when it has actually finished drawing
---

An agent that can see what it built recovers from mistakes a validator cannot
catch: an empty track, a refName mismatch, a region with no data. This page is
about producing that image.

## Which tool

|        | [`@jbrowse/img`](/docs/jbrowse-img) | `@jbrowse/capture`                                       |
| ------ | ----------------------------------- | -------------------------------------------------------- |
| how    | server-side React, no browser       | Puppeteer against a real instance                        |
| output | SVG or PNG                          | PNG                                                      |
| speed  | fast, no Chromium download          | slower, launches a browser                               |
| shows  | the tracks                          | the whole app: chrome, menus, dialogs, overview ideogram |
| covers | the SVG-export rendering path       | canvas and WebGPU rendering, exactly as a user sees it   |

Reach for `@jbrowse/img` by default: a static figure of some tracks is what most
requests amount to, and it needs no browser at all. Reach for `@jbrowse/capture`
when the answer depends on the real application — a canvas-rendered display, a
view type the static exporter does not cover, a dialog or menu, or when you want
to click something and read the resulting state back.

## Quickstart

```bash
## a static render
npx @jbrowse/img --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 --out brca1.png

## the real app
npx @jbrowse/capture --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 -o brca1.png
```

Both take `--hub` for a [hosted assembly](/docs/agents_hosted_data), `--config`
for any config URL, and `--loc` as either a locstring or — on a config with a
text index — a gene name. `jb2capture --help` lists the rest.

```bash
## point at your own data instead
npx @jbrowse/capture --config https://example.org/config.json --assembly mygenome \
  --loc "chr3:25,325,000-25,361,000" --track my_track -o out.png

## a whole session spec, for several views or per-display settings
npx @jbrowse/capture --hub hg38 --session spec.json -o out.png
```

## Knowing when it is done {#knowing-when-it-is-done}

This is the entire problem, and the reason a helper library exists rather than a
paragraph telling you to call `page.screenshot()`.

JBrowse loads a config, builds a session, resolves an assembly, fetches each
track, and then draws to a canvas. A screenshot taken at any point before the
last step is a picture of an empty browser — and it is a _plausible_ picture, so
nothing downstream flags it.

The trap is that **every readiness signal JBrowse publishes is negative**: no
loading overlay, no display in its loading phase, no unpainted canvas. Each is
the right thing to wait on once the app is running, and each is trivially true
before it starts. The events run in this order:

```
navigation resolves  ->  session exists  ->  assembly and tracks land  ->  loading overlay goes up  ->  displays draw
```

A wait chain built only from the negative signals is satisfied at the first
arrow, because at that moment there is no overlay to clear and no display to be
unpainted. It returns almost immediately and reports success. `networkidle` does
not save you either — it fires before the session is built, and an app streaming
track data may never go idle at all.

So put a **positive gate** in front: wait until the thing you asked for exists.
jbrowse-web publishes its live session model as `window.JBrowseSession`, which
makes that a direct read rather than a guess. This is the gate
`@jbrowse/capture` runs, spliced from its own source so the two cannot drift:

<!-- include: products/jbrowse-capture/src/sessionGate.ts#session-gate -->
<!-- prettier-ignore -->
```ts
await page.waitForFunction(
  (wantAssembly: string | null, wantTracks: string[]) => {
    const session = (
      globalThis as { JBrowseSession?: { views?: ViewState[] } }
    ).JBrowseSession
    const views = session?.views
    if (!views?.length) {
      return false
    }
    // `initialized` is an LGV getter; a view type without one is mounted
    // content the moment it exists, so absent counts as initialized and
    // only an explicit false is pending.
    if (views.some(v => v.initialized === false)) {
      return false
    }
    if (
      wantAssembly !== null &&
      !views.some(v => (v.assemblyNames ?? []).includes(wantAssembly))
    ) {
      return false
    }
    const open = new Set(
      views.flatMap(v =>
        (v.tracks ?? []).map(t => t.configuration?.trackId),
      ),
    )
    return wantTracks.every(id => open.has(id))
  },
  { timeout, polling: 250 },
  assembly ?? null,
  trackIds,
)
```

`tracks` and `configuration` are guarded because a view can exist before either
does, which the hand-written version of this snippet used to get wrong.

A config URL that 404s, a `trackId` the config does not define, and an assembly
name that does not match all fail there — and only there. Each of them otherwise
produces a browser that loads, paints its chrome, and photographs perfectly with
nothing in it.

### The DOM signals, after the gate

Once the session holds what you asked for, these are meaningful. Each says
something the others do not, so waiting on one is not waiting on the rest:

| Wait until absent                 | Means                                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[data-view-phase="loading"]`     | no view is still resolving its assembly. Until this clears a view has mounted no displays, so every row below is silent                            |
| `[data-view-component-pending]`   | no view is still waiting on its lazily-imported React component                                                                                    |
| `[data-testid="loading-overlay"]` | no track is still fetching                                                                                                                         |
| `[data-display-phase="loading"]`  | no display is still in its own fetch. The direct read that the rows above only approximate                                                         |
| `[data-display-drawn="false"]`    | every display has painted. `data-display-drawn` flips on FIRST paint, so wait on the fetch rows before this one or it proves nothing about content |

Plus one that is text rather than an attribute: some views paint their own
`Loading…` / `Rendering…` / `Computing…` banner that no test id covers. Waiting
on that text needs a visibility check, because the loading overlay keeps the
literal word "Loading" in the DOM hidden behind `opacity: 0` and a plain text
search never clears.

**These attributes are not on every build.** They come from `ViewContainer` and
`DisplayChrome` in current code; a JBrowse deployment predating them publishes
only the loading overlay, and the display-level waits are then unfalsifiable
rather than satisfied. `@jbrowse/capture` detects which one it got, falls back
to a bounded settle, and says so on stderr — because "no display is pending" and
"pending cannot be measured here" look identical in a result and very different
in a figure.

## Writing your own script

```js
import { openJBrowse, waitForJBrowseReady } from '@jbrowse/capture'

// launches, navigates, and runs the whole wait chain above
const { browser, page, pending, paintContract } = await openJBrowse({
  hub: 'hg38',
  loc: 'chr17:43,044,000-43,126,000',
  tracks: ['hg38-ncbiRefSeqCurated'],
  width: 1400,
  height: 900,
})

// now do the thing a static render could not
await page.click('[data-testid="track_menu_icon"]')
await page.screenshot({ path: 'menu.png' })

// read state back out of the running app
const loc = await page.evaluate(
  () => window.JBrowseSession.views[0].coarseDynamicBlocks,
)
await browser.close()
```

`waitForJBrowseReady(page)` is the wait on its own, for a page you navigated
yourself, and each stage is exported separately. `captureJBrowse()` is the
one-call form that launches, waits, shoots and closes.

### A stage that times out fails the run

Puppeteer waits are usually written best-effort — `.catch(() => {})` — so a slow
page is not failed for being slow. The cost is that "everything settled" and "we
gave up" become the same `void`, and the run ends with an image and an exit code
of 0 either way. That is the same ambiguity as the vacuous gate above, arriving
one step later.

So each stage reports its outcome, and an unsettled one throws by default,
naming which gate and what to do:

```
gave up waiting after 2000ms: the loading overlay never cleared (a track fetch
never finished). Raise the timeout if the page is merely slow; if it never
finishes, open the same URL in a browser — this gate has no content to fall
through to.
```

Three fields come back with a successful capture, all about honesty rather than
success. `unsettled` lists stages that timed out (empty unless you asked to
proceed anyway). `pending` lists displays still unpainted at the moment of
capture — a display can go back to pending after its stage passed, so this is a
separate question from `unsettled`. `paintContract` says whether the build could
report that at all.

Pass `allowUnsettled` (`--allowUnsettled`) to get the frame as it stands
instead; the stages are still listed, and the CLI prints them as warnings.

## Practical notes

- **The browser renders in software** unless you give it a GPU. A view that is
  slow or fails on volume under headless Chromium may be fine in a real one, so
  do not conclude anything about JBrowse's limits from a headless run.
- **In a container**, pass `--no-sandbox`; `@jbrowse/capture` already does, and
  exports `SANDBOX_CHROME_ARGS` for scripts that specifically need web security
  left on.
- **A retina image** is `--scale 2`, which is the default here because a figure
  usually wants it. Drop it to 1 for a screenshot you only intend to read.
- **A slow remote file** outlives the loading overlay. Raise `--timeout`, and
  `--settle` for the last repaint.
- **Read the image you produced.** An empty track is obvious in a picture and
  invisible in an exit code — that is the whole reason to take one.

## See also

- [](/docs/agents) — the loop this closes
- [](/docs/agents_hosted_data) — data to point it at with no setup
- [](/docs/jbrowse-img) — the static exporter's full reference
- [](/docs/urlparams) — the parameters and session spec these tools build
