# Handoff: auto-capturing videos with Puppeteer (website)

## Goal

Add auto-generated **videos** (motion tours) alongside the existing
auto-generated screenshots, so the gallery/docs can show panning + zooming in
motion, not just stills. Requested "using puppeteer".

## Status: PROTOTYPE WORKS END-TO-END ✅ (not yet wired into the spec system)

`website/scripts/generate-video.ts` (untracked, not committed) produces a clean
`static/video/volvox_tour.{webm,mp4,gif}` on every run. Run it with:

```bash
cd website
node scripts/generate-video.ts           # headless (CI path)
node scripts/generate-video.ts --headed  # real GPU, local
```

(Use `node`, NOT tsx — same reason as generate-screenshots.ts: tsx's keepNames
breaks `page.evaluate`'d fns.)

### What it does

- Serves `products/jbrowse-web/build` via `createTestServer` on **port 3335**
  (avoids screenshots' 3334 and a dev server on 3000), loads a volvox LGV
  session (`lgvSession`) with **`volvox_microarray` (wiggle) +
  `gff3tabix_genes`** pre-opened, then records `page.screencast()` while it
  drives a zoom-in → zoom-out tour.
- **All motion is real UI button clicks.** `clickButton()` finds the
  `zoom_in`/`zoom_out` header control, glides a **fake cursor overlay** onto it,
  plays a click-ripple pulse, then does the real `.click()` (which fires the
  animated `model.zoom()` spring). No model-poking, no synthetic `zoomTo`.
- **Fake cursor**: headless Chrome renders no OS cursor into the screencast, so
  `injectCursor()` adds an arrow `<div>` kept in sync with `page.mouse` (CSS
  `transform` glide), plus `clickPulse()` for an expanding ring on each click.
- Finalizes the webm (`recorder.stop()` in a `finally`), then ffmpeg-transcodes
  to mp4 (h264/yuv420p +faststart) and a preview gif, and **verifies the mp4 has
  a real duration** to catch a truncated capture.

### The old "finalization bug" — ROOT-CAUSED and FIXED

The prototype used to hang in `recorder.stop()` / leave an unfinalized webm. The
real cause was **not** puppeteer and **not** stop(): the tour opened a **CRAM
pileup** track and drove `.click()` mid-zoom. Under headless
`--enable-unsafe-swiftshader` (software WebGL), re-rendering the dense pileup
each animated-zoom frame is CPU-rasterized and **blocks the main thread ~7s per
zoom step**. That starves the click's clickable-point `Runtime.callFunctionOn`
round-trip until it nearly times out and throws "Target closed", and starves the
whole script (stepped mouse, evaluate — everything queues behind the block).

Proven, not guessed (6× animated zoom, same session/tracks, only GL backend
differs):

| environment                                       | zoom-in ×6 | result                               |
| ------------------------------------------------- | ---------: | ------------------------------------ |
| headless swiftshader + CRAM pileup                |       ~28s | stalls, click throws "Target closed" |
| **headed real GPU** (Intel UHD 630) + CRAM pileup |      ~8.6s | smooth                               |
| headless swiftshader + wiggle+genes               |      ~8.6s | smooth                               |

So the multi-second freeze is a **swiftshader software-rasterization artifact**,
not a rendering-code bug — real users on a GPU don't hit it. The fix is to keep
the headless tour on **light tracks** (wiggle + genes); it then never blocks,
the clicks resolve instantly, and `recorder.stop() → ok` in ~0.5s. Heavy pileups
can still be filmed via `--headed` (real GPU).

Note: a finalized VP9/webm from `page.screencast()`'s ffmpeg pipe legitimately
reports `duration=N/A` at the container level — that is normal, **not** a sign
of truncation. Verify via the transcoded **mp4**'s duration instead (the script
does). The old "File ended prematurely" symptom was the genuinely truncated file
from the hang, now gone.

### Separately: real (milder) interaction jank on hardware

Distinct from the swiftshader freeze, there IS a measured per-frame cost on real
GPUs during alignments zoom/pan (~21ms/frame at 4× CPU throttle) —
per-interaction React/MUI/Emotion re-renders (measured: the LGV coordinate ruler
`ScalebarCoordinateLabels`' per-zoom tick churn, not the alignments overlays),
not GPU draw. See the "Perf" section of `agent-docs/OTHER_IDEAS.md` (+ profiler
in `~/src/jb2bench`). It is not what broke the video.

## Integration plan (once the prototype is solid) — NOT started

This is still a throwaway script. To productionize, mirror the screenshot
pipeline's structure:

- Add a `VideoSpec` type (name + session URL + an `actions`-style motion
  timeline) alongside the screenshot specs in `scripts/screenshot-specs.ts` (or
  a new `video-specs.ts`), reusing the existing `ScreenshotAction`/`runAction`
  machinery for the motion steps (extend it with the cursor overlay so clicks
  are visible).
- Generalize `generate-video.ts` into a spec-driven generator with the same CLI
  ergonomics as generate-screenshots.ts (`--filter`, `--concurrency`, etc.).
- Decide output format/location: `website/static/video/<name>.{webm,mp4,gif}`.
  webm+mp4 for `<video>` embeds, gif for inline previews / GitHub markdown.
- Decide how docs embed them (a `<Video>` MDX component paralleling `<Figure>`,
  and gallery integration). Videos are NOT deterministic like the stills, so the
  content-stable diff gate the screenshots use does NOT apply — plan a different
  "don't churn git" strategy (e.g. only regenerate on demand, keep them out of
  the default `pnpm screenshots` run).

## Key files

- `website/scripts/generate-video.ts` — the prototype (this work).
- `website/scripts/generate-screenshots.ts` — the model to follow for
  spec-driven structure, launch options, server, waits.
- `website/scripts/actions.ts` — `runAction`, `setLocation`, `openTrack`, drag/
  zoom-capable primitives to reuse for motion timelines.
- `website/scripts/screenshot-spec-helpers.ts` — `lgvSession`, `VOLVOX`,
  `sessionSpec` (session-URL builders).
- `plugins/linear-genome-view/.../HeaderZoomControls.tsx` — `zoom_in`/`zoom_out`
  testids; `.zoom()` animates, `.zoomTo()` does not.

## Uncommitted / working-tree note

`generate-video.ts` and `static/video/*` are new & untracked. The branch also
had pre-existing unrelated edits (arc/wiggle menu files) — leave those alone.
Shared worktree: commit with explicit pathspecs only, never `git add -A`, never
`git stash`.
