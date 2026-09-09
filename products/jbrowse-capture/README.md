# @jbrowse/capture

Drive a live JBrowse 2 instance with Puppeteer and screenshot it **once it has
actually finished rendering**.

```bash
npx @jbrowse/capture --hub hg38 --loc BRCA1 \
  --track hg38-ncbiRefSeqCurated --track hg38-phyloP100way -o brca1.png
```

`--hub` names an assembly on [genomes.jbrowse.org](https://genomes.jbrowse.org),
which hosts a ready-made JBrowse config per UCSC and GenArk genome, and `--loc`
takes a gene name because those configs ship a text index.

## Knowing when JBrowse has finished rendering

Knowing when a genome browser is done is the entire problem. JBrowse loads its
config, builds a session, resolves an assembly, fetches each track, and then
draws to a canvas — and a screenshot taken at any point before the last step is
a picture of an empty browser that looks like a successful run.

Nearly every signal a browser publishes is **negative** — no loading overlay, no
display in its loading phase, no unpainted canvas — and an absence is equally
true of a page whose JavaScript has not started. Measured against a released
build with two remote tracks:

- `networkidle2` resolves at ~350ms
- the session appears at ~880ms
- the assembly and tracks land at ~2500ms
- the loading overlay only goes up _after that_

A wait chain built from those signals alone finishes in under a second and
reports success.

So this package waits on the two **positive** signals instead, and nothing else
decides the answer:

1. **The census.** `AppReadyMarker` publishes what is open as `data-app-views`,
   `data-app-assemblies` and `data-app-tracks`, and the gate reads that one
   element: at least one view, your assembly among them, every trackId you named
   actually open. A config URL that 404s, a trackId the config does not define
   and an assembly name that does not match the config all fail here, loudly,
   and this is the only place they fail at all.
2. **`[data-app-phase="ready"]`, held.** The session renders it when no view is
   resolving an assembly and no display is fetching. It has to hold for a beat,
   not merely be true once: a display drops to `ready` in the gap between one
   fetch finishing and the debounced next one starting.

Then one negative gate, which is meaningful only after those two and answers
what they do not — the marker is about WORK, and a display whose fetch failed is
not working, so it reads `ready` over an error banner. `data-display-drawn` is
the stricter question, and the census of what is still unpainted goes in the
error.

**A build that publishes no `[data-app-phase]` is an error, not a slower path.**
The fallback chain that used to run there was those negative signals plus a
seen-busy-then-quiet heuristic to compensate for them, and it existed for builds
older than the marker. Point `--instance` at a build that has it.

## Library

```js
import { captureJBrowse, openJBrowse } from '@jbrowse/capture'

// one call: launch, wait, shoot, close
const { pending, unsettled } = await captureJBrowse({
  hub: 'hg38',
  loc: 'BRCA1',
  tracks: ['hg38-ncbiRefSeqCurated'],
  out: 'brca1.png',
})

// or keep the page, to click things and read state back
const { browser, page } = await openJBrowse({ hub: 'mm39', loc: 'Sox2' })
const tracks = await page.evaluate(
  () => window.JBrowseSession.views[0].tracks.length,
)
await browser.close()
```

Two waits, depending on what you did:

- **`waitForJBrowseReady(page)`** is the wait on its own, for a page you
  navigated yourself. The individual stages (`waitForSession`,
  `waitForLoadingComplete`, `waitForDisplaysDone`, `waitForQuiescent`, ...) are
  exported too, and each one documents what it can and cannot tell you.
- **`waitForAppSettled(page)`** is the wait after you CLICK something. A page
  that is loading starts out `loading` and the transition into `ready` is it
  finishing; a page you just clicked is already `ready` and stays that way until
  the click's work registers, so waiting for `ready` there returns on the
  pre-click frame. `waitForAppSettled` requires it to hold, and throws on a
  build with no marker rather than falling back to a wait that cannot fail.

## Timeouts and unsettled waits

Puppeteer waits are usually written `.catch(() => {})` so a slow page is not
failed for being slow. The cost is that "everything settled" and "we gave up"
become the same `void` — the run ends with an image and an exit code of 0 either
way, which is the vacuous-gate problem again, one step later.

Here every stage reports its outcome, and an unsettled one throws by default,
naming the gate:

```
gave up waiting after 2000ms: the loading overlay never cleared (a track fetch
never finished). Raise the timeout if the page is merely slow; if it never
finishes, open the same URL in a browser — this gate has no content to fall
through to.
```

`allowUnsettled` (`--allowUnsettled`) takes the frame as it stands instead, and
still tells you what did not settle.

## Reading the result

Two fields on a successful capture:

- **`unsettled`** — stages that hit their timeout. Empty unless you asked to
  proceed anyway.
- **`pending`** — displays still reporting unpainted when the shutter fired.
  Read after `settle`, not before it, so the frame it describes is the frame
  that was captured; a display that finished during the settle is not in it, and
  no longer fails the run either. Whatever is left lands in `unsettled` too,
  carrying each display's own phase — `loading` is a slow fetch, `error` a
  banner, `ready` a display claiming it finished without drawing.

## CLI

`jb2capture --help` for the full list. Also:

```bash
jb2capture list hg38 conservation   # trackIds matching a filter
jb2capture url --hub hg38 --loc BRCA1   # just print the link, no browser
```

## See also

- [@jbrowse/img](https://www.npmjs.com/package/@jbrowse/img) renders SVG/PNG
  with no browser at all, via server-side React. Prefer it for a static figure;
  use this when you need the real app — canvas and WebGPU rendering, dialogs,
  menus, or state read back out of a running session.
- [Using JBrowse with AI agents](https://jbrowse.org/jb2/docs/agents/)
