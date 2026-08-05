# Screenshot capture race: "empty canvas" figures

A canvas/GPU display's figure occasionally captures **empty** (no features), even
though the same spec renders fine on the dev server and on clean re-runs. This is
a **screenshot-generator capture race**, not a data/adapter/refName bug. This
note explains the failure and the fix pattern, so the next "empty painting"
report doesn't get mis-diagnosed as an adapter problem.

## The concrete case (trio-ancestry)

`trio-ancestry` (a `LinearMultiRowFeatureDisplay` painting an ASW trio's six
haplotypes by local ancestry) rendered empty in the committed PNG. It was
reported — twice — as a data bug: first "BedTabix partition column not read",
then "refName aliasing broken". **Both were wrong.**

What was actually true:

- refName aliasing works. The hosted BED uses `chr1`; the hg38 assembly's
  canonical refName is `1`; the rename (`RpcMethodTypeWithRenameRegion` →
  `getRefNameMapForAdapter` → nested `CoreGetRefNames`) maps `1`→`chr1`
  correctly. Verified end to end.
- The BedTabix `sample`/`ancestry` extra columns parse fine (`defaultParser`
  zips `columnNames` to values; `feature.get('sample')` returns the row label).
- On the dev server the painting renders every time.

The empty capture was **intermittent** — the exact same spec rendered a full
6-row painting on clean sequential re-runs, and captured empty when the machine
was under load (concurrent builds).

## Why it happens

The generator's readiness waits (`waitForLoadingComplete`, `waitForDisplaysDone`)
key off the display's own "ready" signals — the loading overlay clearing and the
`<testid>-done` suffix, both driven by `canvasDrawn`. **`canvasDrawn` can flip on
an empty first paint**, before the feature data has been fetched and drawn. Under
a slow first fetch (the first RPC on a session lazily boots the web worker; a
heavy config or a loaded machine makes that boot slow), the display briefly reads
as "ready" with nothing painted, and a fixed `settleMs` can elapse inside that
window — so the capture lands on an empty frame. `waitForDisplaysDone` also
swallows its own timeout, so a genuinely-never-finished render commits empty
rather than failing loudly.

Two red flags this matches (both already called out in
`website/CLAUDE.md`): a capture gated on a **fixed `settleMs`**, and a `readyText`
that matches the **track name** (present immediately) rather than the rendered
content.

## The fix pattern: gate on a data-derived DOM signal

Wait on something in the DOM that can only exist **after the feature data has
loaded and been processed** — not on `canvasDrawn`/settle. The color legend is
ideal: it renders one entry per binned value, so it is absent until real data
arrives.

- `SvgColorLegend` (`packages/core/src/ui`) takes an optional `testid` prop,
  applied to its outer `<g>` — which only renders when there are entries.
- `MultiRowColorLegend` passes `testid="multirow-color-legend"`.
- The spec sets `readySelector: '[data-testid="multirow-color-legend"]'`.

Result: content-stable (0.000% diff across runs), always the full painting; and
if data genuinely never loads, the wait times out and the spec **fails loudly**
instead of committing an empty PNG.

### Gotcha: the `-done` wrapper is 0-height

The obvious signal, `[data-testid="<name>-display-done"]`, does **not** work
through a `readySelector` (which uses puppeteer `waitForSelector({visible:true})`):
the GPU displays paint into a `position:absolute` canvas, so the DisplayChrome
wrapper collapses to **height 0** and never passes the visibility check (it
`EXISTS` but is not `VISIBLE`). The generator's own `waitForDisplaysDone` gets
away with it because it queries the wrappers by **existence**
(`querySelectorAll`), not visibility — but it's an early (`canvasDrawn`) signal
and swallows timeouts, so it isn't a reliable capture gate on its own. Pick a
data-derived, actually-drawn element (legend, a rendered label) for
`readySelector`.

Note that `settleMs` is purely the **timeout** on that wait, never a floor: a
page whose displays are all painted (or that has no canvas display at all —
a menu, widget, or import-form figure) proceeds immediately. It used to burn the
full duration whenever no wrapper matched, which made it read like a fixed
sleep and invited tuning it as one.

## The other blank capture: `el.screenshot()` vs the compositor

The section above is the **website generator's** race, and its fix is a better
readiness wait. The browser-test suite
(`products/jbrowse-web/browser-tests`) has a second, unrelated one that no wait
can fix, and the two get confused because the symptom is identical.

There, a capture came back blank while **every** app-level signal was legitimately
true — loading overlay down, no display in its `loading` phase, every display
reporting `canvasDrawn`, morph idle. Measured 34 of 34 blanks that way, on both
the canvas2d and webgl backends, so it is neither a GPU-driver story nor a
slowness one. `preserveDrawingBuffer` and a compositor double-rAF were both
tested and neither helped (see the handoff for the tables).

The question was settled by asking the canvas instead of arguing about it.
`el.screenshot()` goes through Chrome's capture path, which serves **composited
layers**; `canvas.toDataURL()` reads the **backing store** and never touches the
compositor. So on a blank capture the two answers separate the causes, and one
occurrence decides it:

```
[self-report: canvas 1193x529 HAS content (19442b) while the screenshot is blank
              -> capture/compositing side]
[self-report: canvas 1268x100 is ALSO blank -> render side]
```

Both verdicts have now been observed. The first is the one that matters: the app
had drawn, and the capture path handed back an empty image.

### Those bytes diagnose the blank. They are not a substitute capture.

The obvious next step — use the `toDataURL` bytes as the capture, since they are
demonstrably the render — was implemented, measured, and reverted the same day.
A recovered `targeted_variants-assembly-aliases` came back **93.65% different**
from the other backend's screenshot of the same view, and the diff image showed
every glyph landing in an identical place over a wholly different background:

- `toDataURL` returns the canvas's own pixels with **alpha unflattened**;
  `el.screenshot()` returns the element box **composited** over what is behind it.
- `el.screenshot()` also captures any DOM drawn over the canvas, and the selector
  can name a wrapper holding more than one canvas. `toDataURL` sees neither.

The drawings agree; the capture paths do not. A differential oracle that compares
one backend's backing store against another's composited layers is comparing
capture paths, not renderers — and a false 93% drift is much worse for a blocking
gate than a re-run. So a blank capture fails its test, and the CI gate's
fresh-browser retry takes it again through the same path on both sides.

`assertCanvasHasContent` is the one place the backing store *is* authoritative:
it asks "did this display draw" and compares no bytes against anything.

Two further limits:

- **A "render side" verdict on webgl is not conclusive** — a cleared drawing
  buffer reads identically. On canvas2d it is conclusive.
- **None of this masks a shader that draws nothing.** That canvas self-reports
  blank too, and still fails with the render-side verdict.

## Debugging tips that saved time here

- `page.on('console')` **does** forward web-worker console in current puppeteer,
  but the generator filters it; when in doubt, attach a CDP
  `Target.setAutoAttach` session and read `Runtime.consoleAPICalled` to see the
  main/worker boundary. That's what proved the worker was the slow step and the
  render itself was correct.
- The RPC worker boots lazily on the first call and the boot needs the main
  thread to answer its `readyForConfig` postMessage; a saturated main thread (big
  config parse) delays the boot, which is what stretches the "ready-but-empty"
  window. Adding `console.error` instrumentation changed the timing enough to
  hide the race — beware Heisenbugs here.
- Reproduce reliability with N forced runs and watch the content-stable diff
  percentage; a figure that flips between two states shows up as an occasional
  large `% diff` on `--force` re-render.
