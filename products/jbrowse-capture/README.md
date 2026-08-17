# @jbrowse/capture

Drive a live JBrowse 2 instance with Puppeteer and screenshot it **once it has
actually finished rendering**.

```bash
npx @jbrowse/capture --hub hg38 --loc BRCA1 \
  --track hg38-ncbiRefSeqCurated --track hg38-phyloP100way -o brca1.png
```

No config to write and no server to run: `--hub` names an assembly on
[genomes.jbrowse.org](https://genomes.jbrowse.org), which hosts a ready-made
JBrowse config per UCSC and GenArk genome, and `--loc` takes a gene name because
those configs ship a text index.

## Why this exists rather than a `page.screenshot()`

Knowing when a genome browser is done is the entire problem. JBrowse loads its
config, builds a session, resolves an assembly, fetches each track, and then
draws to a canvas — and a screenshot taken at any point before the last step is
a picture of an empty browser that looks like a successful run.

Every readiness signal JBrowse publishes is **negative**: no loading overlay, no
display in its loading phase, no unpainted canvas. All of them therefore pass on
a page whose JavaScript has not started yet. Measured against
`jbrowse.org/code/jb2/latest`: `networkidle2` resolves at ~350ms, the session
appears at ~880ms, the assembly and tracks land at ~2500ms, and the loading
overlay only goes up _after that_. A wait chain built from those signals alone
finishes in under a second and reports success.

So this package puts a **positive gate** in front of them, read off the live MST
session model that jbrowse-web publishes as `window.JBrowseSession`: the session
exists, its views are initialized, and the assembly and trackIds you asked for
are the ones actually open. A config URL that 404s, a trackId the config does
not define, and an assembly name that does not match all fail there, loudly,
instead of producing a beautiful photograph of nothing.

## Library

```js
import { captureJBrowse, openJBrowse } from '@jbrowse/capture'

// one call: launch, wait, shoot, close
const { pending, paintContract } = await captureJBrowse({
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

`waitForJBrowseReady(page)` is the wait on its own, for a page you navigated
yourself. The individual stages (`waitForSession`, `waitForLoadingComplete`,
`waitForDisplaysDone`, `waitForQuiescent`, ...) are exported too, and each one
documents what it can and cannot tell you.

After you CLICK something, the wait is `waitForAppSettled(page)` instead. A page
that is loading starts out `loading` and the transition into `ready` is it
finishing; a page you just clicked is already `ready` and stays that way until
the click's work registers, so waiting for `ready` there returns on the
pre-click frame. `waitForAppSettled` requires it to hold.

## No silent best-effort waits

Puppeteer waits are usually written `.catch(() => {})` so a slow page is not
failed for being slow. The cost is that "everything settled" and "we gave up"
become the same `void` — the run ends with an image and an exit code of 0 either
way. That is the vacuous-gate problem again, one step later.

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

Three fields on a successful capture, all about honesty rather than success:

- **`unsettled`** — stages that hit their timeout. Empty unless you asked to
  proceed anyway.
- **`pending`** — displays still reporting unpainted when the shutter fired. A
  display can return to pending after its stage passed, so this is a separate
  question from `unsettled`.
- **`paintContract`** — whether this JBrowse build publishes the per-display
  paint attributes at all. It does not on the current released build, which is
  what every genomes.jbrowse.org link opens; there, `pending: []` means "cannot
  tell", not "all done", and the CLI says so. A page with no tracks open reports
  true — there is nothing to measure, which is not the same as being unable to.

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
