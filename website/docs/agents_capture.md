---
title: Capturing a JBrowse view from a script
sidebar_label: Screenshots
description:
  Render a view to an image from the command line, or drive the real app with
  Puppeteer, and know when it has actually finished drawing
---

An agent that can see what it built recovers from mistakes a validator cannot
catch: an empty track, a refName mismatch, a region with no data. Inside JBrowse
Desktop the MCP `screenshot` tool already waits and reports for you. From a
script there are two tools:

|        | [`@jbrowse/img`](/docs/jbrowse-img) | [`@jbrowse/capture`](/docs/jbrowse-capture)              |
| ------ | ----------------------------------- | -------------------------------------------------------- |
| how    | server-side React, no browser       | Puppeteer against a real instance                        |
| output | SVG or PNG                          | PNG                                                      |
| speed  | fast, no Chromium download          | slower, launches a browser                               |
| shows  | the tracks                          | the whole app: chrome, menus, dialogs, overview ideogram |
| covers | the SVG-export rendering path       | canvas and WebGPU rendering, exactly as a user sees it   |

- `@jbrowse/img` by default: a static figure of some tracks is what most
  requests amount to.
- `@jbrowse/capture` when the answer depends on the real application: a
  canvas-rendered display, a dialog or menu, or state you want to click into and
  read back.

```bash
## a static render
npx @jbrowse/img --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 --out brca1.png

## the real app
npx @jbrowse/capture --hub hg38 --track hg38-ncbiRefSeqCurated --loc BRCA1 -o brca1.png

## your own config, or a whole session spec
npx @jbrowse/capture --config https://example.org/config.json --assembly mygenome \
  --loc "chr3:25,325,000-25,361,000" --track my_track -o out.png
npx @jbrowse/capture --hub hg38 --session spec.json -o out.png
```

- `--hub` names a [hosted assembly](/docs/agents_hosted_data), `--config` any
  config URL, and `--loc` takes a gene name on a config with a text index.
- `@jbrowse/capture` drives the public JBrowse Web build, so a config and its
  data have to be URLs that page may fetch.
- `--instance http://localhost:3000` points it at a build of your own, served by
  anything that honors `Range` requests (`npx serve` does,
  `python3 -m http.server` does not).

## Knowing when the render is done {#knowing-when-it-is-done}

JBrowse loads a config, builds a session, resolves an assembly, fetches each
track, and then draws to a canvas. A screenshot taken before the last step is a
plausible picture of an empty browser, so nothing downstream flags it.

For a page that is loading, the answer is one selector:

```js
await page.waitForSelector('[data-app-phase="ready"]')
```

- The session renders that itself: `ready` when no view is resolving an assembly
  and no display is fetching. It is positive, so it cannot be true before the
  app exists.
- `@jbrowse/capture` gates it further on the assembly and track ids the app
  publishes beside the marker, so a config URL that 404s, a `trackId` the config
  does not define and an assembly name that does not match all fail there rather
  than photographing an empty browser.
- After a click the app is already `ready` and stays that way until the click's
  work registers, so a wait for `ready` returns at once on the pre-click frame.
  `waitForAppSettled(page)` requires `ready` to hold for a beat.

For one display rather than the whole app:

- `data-testid` names the display type (`pileup-display`, `wiggle-display`) and
  never changes; `data-display-id` names the individual display.
- Readiness is a separate attribute: `[data-display-phase="ready"]` once its
  fetch is done, `[data-display-drawn="true"]` once it has painted.
- `displaySettled`, `displayPainted` and `displayById` in `@jbrowse/capture`
  build the combined selectors.
- A dotplot and a synteny level publish no phase, so they report through
  `data-display-drawn` alone, and `pending` in the capture result names anything
  that had still not painted.

## Practical notes

- **The browser renders in software** unless you give it a GPU. A view that is
  slow or fails on volume under headless Chromium may be fine in a real one, so
  do not conclude anything about JBrowse's limits from a headless run.
- **In a container**, pass `--no-sandbox`; `@jbrowse/capture` already does.
- **A retina image** is `--scale 2`, the default. Drop it to 1 for a screenshot
  you only intend to read.
- **A slow remote file** outlives the loading overlay. Raise `--timeout`, and
  `--settle` for the last repaint.
- **Read the image you produced.** An empty track is obvious in a picture and
  invisible in an exit code, which is the whole reason to take one.
