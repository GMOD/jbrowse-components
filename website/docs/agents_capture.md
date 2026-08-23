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

## Choosing a capture tool

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

Both take the same three flags:

- `--hub` for a [hosted assembly](/docs/agents_hosted_data)
- `--config` for any config URL
- `--loc` as either a locstring or — on a config with a text index — a gene name

`jb2capture --help` lists the rest.

The page `@jbrowse/capture` drives is the public JBrowse Web build at
`jbrowse.org/code/jb2/latest/`, which is why a config and its data have to be
URLs that page may fetch. `--instance http://localhost:3000` points it at a
build of your own instead, and [](/docs/agents#where-the-browser-comes-from) is
the setup that goes with it.

```bash
## point at your own data instead
npx @jbrowse/capture --config https://example.org/config.json --assembly mygenome \
  --loc "chr3:25,325,000-25,361,000" --track my_track -o out.png

## a whole session spec, for several views or per-display settings
npx @jbrowse/capture --hub hg38 --session spec.json -o out.png
```

## Knowing when the render is done {#knowing-when-it-is-done}

This is the entire problem, and the reason a helper library exists.

JBrowse loads a config, builds a session, resolves an assembly, fetches each
track, and then draws to a canvas. A screenshot taken at any point before the
last step is a picture of an empty browser — and it is a _plausible_ picture, so
nothing downstream flags it.

On a current build the answer is one selector:

```js
await page.waitForSelector('[data-app-phase="ready"]')
```

The session renders that itself — `ready` when no view is resolving an assembly
and no display is fetching, `loading` whenever one is. It is **positive**, so it
cannot be true before the app exists, and it is a single element.

That is the answer for a page that is LOADING. After you click something it is
not, and the wait is `waitForAppSettled(page)` instead — see
[Writing your own script](#writing-your-own-script).

A loading page starts at `loading`, so the transition into `ready` is the app
finishing. An app you have just clicked is already `ready` — it finished a
moment ago — and stays that way until the click's work registers, which for
anything that dirties the viewport is up to a debounce later. A wait for `ready`
posted in that gap returns immediately, on the pre-click frame.
`waitForAppSettled` requires `ready` to hold for a beat, which covers the gap.

The rest of this section is why the older signals need more care, and what
`@jbrowse/capture` does against a deployment that predates the marker.

The trap is that **every OTHER readiness signal JBrowse publishes is negative**:
no loading overlay, no display in its loading phase, no unpainted canvas. Each
is the right thing to wait on once the app is running, and each is trivially
true before it starts. The events run in this order:

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
    // A container view (synteny, dotplot) keeps its assemblies on the rows
    // and its tracks on the levels, so both walks descend into sub-views
    // and levels rather than reading the top view only.
    const asmOf = (v: ViewState): string[] => [
      ...(v.assemblyNames ?? []),
      ...(v.views ?? []).flatMap(asmOf),
    ]
    if (
      wantAssembly !== null &&
      !views.some(v => asmOf(v).includes(wantAssembly))
    ) {
      return false
    }
    const tracksOf = (v: ViewState): TrackState[] => [
      ...(v.tracks ?? []),
      ...(v.levels ?? []).flatMap(l => l.tracks ?? []),
      ...(v.views ?? []).flatMap(tracksOf),
    ]
    const open = new Set(
      views.flatMap(v => tracksOf(v).map(t => t.configuration?.trackId)),
    )
    return wantTracks.every(id => open.has(id))
  },
  { timeout, polling: 250 },
  assembly ?? null,
  trackIds,
)
```

`tracks` and `configuration` are guarded because a view can exist before either
does.

A config URL that 404s, a `trackId` the config does not define, and an assembly
name that does not match all fail there — and only there. Each of them otherwise
produces a browser that loads, paints its chrome, and photographs perfectly with
nothing in it.

### The DOM readiness signals

Once the session holds what you asked for, these are meaningful. Each says
something the others do not, so waiting on one is not waiting on the rest:

| Wait until absent                 | Means                                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[data-view-phase="loading"]`     | no view is still resolving its assembly. Until this clears a view has mounted no displays, so every row below is silent                            |
| `[data-view-component-pending]`   | no view is still waiting on its lazily-imported React component                                                                                    |
| `[data-testid="loading-overlay"]` | no track is still fetching                                                                                                                         |
| `[data-display-phase="loading"]`  | no display is still in its own fetch. The direct read that the rows above only approximate                                                         |
| `[data-display-drawn="false"]`    | every display has painted. `data-display-drawn` flips on FIRST paint, so wait on the fetch rows before this one or it proves nothing about content |

**Targeting one display rather than all of them.** `data-testid` names the
display _type_ (`pileup-display`, `wiggle-display`, `synteny_canvas`, …) and is
stable for the element's whole life; `data-display-id` names the individual
display. Neither carries readiness, so "this display, painted" is a conjunction,
and `@jbrowse/capture` exports the builders for it. The selector each one
produces, spliced from the test that asserts it:

<!-- include: products/jbrowse-capture/src/waits.test.ts#display-selectors -->

```ts
// `data-testid` names the display TYPE and never changes; readiness is a
// separate attribute. "Has the pileup painted" is therefore a conjunction,
// and these builders write it for you — pass one to `page.waitForSelector`.
expect(displayPainted('pileup-display')).toBe(
  '[data-testid="pileup-display"][data-display-drawn="true"]',
)

// The stronger one. `drawn` flips on FIRST paint, so a figure that must show
// data waits on the phase instead — that is the whole fetch, not first paint.
expect(displaySettled('pileup-display')).toBe(
  '[data-testid="pileup-display"][data-display-phase="ready"]',
)

// One display by its config's `displayId`, rather than every display of a type.
expect(displayById('my_pileup')).toBe('[data-display-id="my_pileup"]')
```

Older builds appended `-done` to `data-testid` on first paint (and `_done` on
the synteny/dotplot canvases). That is gone: the id no longer changes, so a
selector written against it keeps matching after the display paints.

Plus `data-busy="true"`, which `LoadingEllipses` sets — the component the app
renders wherever it tells a user it is working, including the banners no
display-level attribute covers. Match the attribute: the loading overlay keeps
the literal `Loading…` in the DOM behind `opacity: 0`, so a text scan needs a
computed-style check on top and breaks on a reworded message or a translation.
`BUSY_SELECTOR` is all four of these together.

**None of these are on every build**, which is the whole reason
`waitForJBrowseReady` is more than one line. `[data-app-phase]` and the
per-element attributes come from current code; a deployment predating them
publishes only the loading overlay, and the display-level waits are then
unfalsifiable rather than satisfied.

Absence answers "is it working now" where a capture needs "has it finished".
Measured on `jbrowse.org/code/jb2/latest` with two remote tracks: the session
reports both tracks open at ~2.5s, and the loading overlay does not go up until
~3.5s. In that second every absence-based gate passes over an app that has drawn
nothing — the old chain returned at 3.9s with `Downloading features.` still on
screen.

So against such a build the wait watches the app WORK instead: it has to be seen
busy and then idle for an unbroken stretch, read from the published attributes
plus each display's own status message on `window.JBrowseSession`. The same run
then returns at 8.3s with both tracks drawn. `appMarker` in the report says
which of the two ran, and the fallback can be deleted once the oldest build
anyone points this at has the marker.

One gate outlives that deletion. The marker is computed from every display that
publishes a phase, and the two comparative views publish none — a dotplot and a
synteny level report paint-complete through `data-display-drawn` alone — so on
those pages `ready` is true of a session that has finished fetching with the
canvas still blank. `waitForJBrowseReady` therefore keeps `waitForDisplaysDone`
after the marker, where it is free on a page with no such canvas, and `pending`
in the report names anything that had still not painted.

## Writing your own script

```js
import {
  openJBrowse,
  waitForAppSettled,
  waitForJBrowseReady,
} from '@jbrowse/capture'

// launches, navigates, and runs the whole wait chain above
const { browser, page, pending, paintContract } = await openJBrowse({
  hub: 'hg38',
  loc: 'chr17:43,044,000-43,126,000',
  tracks: ['hg38-ncbiRefSeqCurated'],
  width: 1400,
  height: 900,
})

// now do the thing a static render could not. The app is `ready` the instant you
// click — it was finished a moment ago — so this second wait is the hold, not the
// selector: it ends once the click's own work has finished and stayed finished.
await page.click('[data-testid="track_menu_icon"]')
await waitForAppSettled(page)
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

### Timeouts and unsettled stages

Puppeteer waits are usually written best-effort — `.catch(() => {})` — so a slow
page is not failed for being slow. The cost is that "everything settled" and "we
gave up" become the same `void`, and the run ends with an image and an exit code
of 0 either way.

So each stage reports its outcome, and an unsettled one throws by default,
naming which gate and what to do:

```
gave up waiting after 2000ms: the loading overlay never cleared (a track fetch
never finished). Raise the timeout if the page is merely slow; if it never
finishes, open the same URL in a browser — this gate has no content to fall
through to.
```

Three fields come back with a successful capture:

- **`unsettled`** lists stages that timed out (empty unless you asked to proceed
  anyway).
- **`pending`** lists displays still unpainted at the moment of capture — a
  display can go back to pending after its stage passed, so this is a separate
  question from `unsettled`.
- **`paintContract`** says whether the build could report that at all.

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
