# Handoff: auto-capturing videos with Puppeteer (website)

## Goal
Add auto-generated **videos** (motion tours) alongside the existing auto-generated
screenshots, so the gallery/docs can show panning + zooming in motion, not just
stills. Requested "using puppeteer".

## Status: PROTOTYPE WORKS, one finalization bug remains

A standalone prototype exists at `website/scripts/generate-video.ts` (NOT yet
wired into the spec system, NOT committed). Run it with:

```bash
cd website
node --experimental-strip-types scripts/generate-video.ts
```

(Use `node --experimental-strip-types`, NOT tsx — same reason as
generate-screenshots.ts: tsx's keepNames breaks `page.evaluate`'d fns.)

### What already works ✅
- Environment is capable: **puppeteer 25.3.0** (has `page.screencast()`) and
  **ffmpeg 8.0** are both installed.
- The prototype serves `products/jbrowse-web/build` via `createTestServer` on
  **port 3335** (avoids the screenshots' 3334 and a dev server on 3000), loads a
  volvox LGV session (`lgvSession` helper) with `volvox_microarray` +
  `volvox_cram_alignments` tracks pre-opened, then records `page.screencast()`.
- **Motion is captured correctly.** Verified by extracting frames from the webm:
  the wiggle xyplot + CRAM pileup render, and the view visibly zooms
  (ctgA:1–50,000 → 13–49,988 → 3,177–46,824), with the "Zoom in 2x" tooltip
  visible. Clicking the `zoom_in`/`zoom_out` header buttons fires `model.zoom()`
  which **animates** (unlike `zoomTo`), so the screencast records smooth motion.
- Motion primitives reused from the screenshot pipeline: `animatedZoom` (clicks
  `[data-testid="zoom_in"|"zoom_out"]`), `panDrag` (stepped `page.mouse` drag).

### The remaining bug 🐛
`recorder.stop()` throws `TargetCloseError: Protocol error
(Runtime.callFunctionOn): Target closed`. Because stop() doesn't complete, the
webm is left **unfinalized** — `ffprobe` shows `duration=N/A`, ffmpeg reports
"File ended prematurely" — so the mp4/gif transcodes at the end of the script
never run. The 27–30MB webm on disk DOES contain the frames (ffmpeg can still
extract them) but is not a clean container.

I already added, in `generate-video.ts`:
- `page.on('error')` + `page.on('pageerror')` crash listeners (to distinguish a
  real tab crash from its downstream "Target closed").
- `recorder.stop()` moved into a `try/finally` around the motion so it's always
  attempted before `browser.close()`.

But if the *target itself* closed (tab crash), `recorder.stop()` still rejects
and the file still won't finalize — so **the root cause must be found, not just
guarded**.

### Leading hypothesis (per CLAUDE.md: prove it, don't work around)
The puppeteer stack trace ends in `CdpElementHandle.evaluate` — that's
`ElementHandle.click()`'s internal clickable-point evaluate. So the failing call
is a `zoom_in`/`zoom_out` `.click()` in the SECOND `animatedZoom` batch (after
the pan). Captured frames stop around there. Candidate causes, in order to test:
1. **Tab crash under swiftshader** rendering the CRAM pileup during zoom. The new
   `page.on('error')` listener will print `PAGE CRASH: ...` if so. **Check the
   run's stdout/stderr first** — if PAGE CRASH appears, it's this.
2. **The pan drag** (`panDrag` at y=500 over the CRAM track) may trigger a
   rubberband/zoom-to-region selection or otherwise leave the page in a state
   that the next click can't resolve. Try removing the pan and re-running.
3. Navigating/zooming detached the element handle. (Less likely — I re-`page.$`
   the button each iteration.)

### Suggested next steps
- Read the latest run's output file for the crash listener lines. Last run
  (task) left `static/video/volvox_tour.webm` at 27MB, dur=N/A, no mp4/gif, and
  an EMPTY stdout file — meaning node likely died before printing; re-run in
  foreground to see the `PAGE CRASH`/`recorder.stop failed` lines.
- If it's a swiftshader crash (hypothesis 1): lighten the render — swap CRAM for
  a gene track (a gene-track tour is arguably a better first demo anyway), and/or
  add memory flags. A gene/wiggle tour won't hit the pileup's per-read load.
- Once a clean webm finalizes, confirm the ffmpeg mp4 (h264/yuv420p +faststart)
  and gif transcodes produce playable files.

### Verify a captured webm (works even while unfinalized)
```bash
ffmpeg -y -i static/video/volvox_tour.webm -vf "fps=1,scale=640:-1" /tmp/vframes/f_%03d.png
convert /tmp/vframes/f_001.png /tmp/vframes/f_004.png /tmp/vframes/f_007.png +append /tmp/montage.png
# then Read /tmp/montage.png
```

## Integration plan (once the prototype is solid) — NOT started
This is still a throwaway script. To productionize, mirror the screenshot
pipeline's structure:
- Add a `VideoSpec` type (name + session URL + an `actions`-style motion
  timeline) alongside the screenshot specs in `scripts/screenshot-specs.ts` (or a
  new `video-specs.ts`), reusing the existing `ScreenshotAction`/`runAction`
  machinery for the motion steps.
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
- `website/scripts/generate-screenshots.ts` — the model to follow for spec-driven
  structure, launch options, server, waits.
- `website/scripts/actions.ts` — `runAction`, `setLocation`, `openTrack`, drag/
  zoom-capable primitives to reuse for motion timelines.
- `website/scripts/screenshot-spec-helpers.ts` — `lgvSession`, `VOLVOX`,
  `sessionSpec` (session-URL builders).
- `plugins/linear-genome-view/.../HeaderZoomControls.tsx` — `zoom_in`/`zoom_out`
  testids; `.zoom()` animates, `.zoomTo()` does not.

## Uncommitted / working-tree note
`generate-video.ts` and `static/video/*` are new & untracked. The branch also had
pre-existing unrelated edits (arc/wiggle menu files) — leave those alone. Shared
worktree: commit with explicit pathspecs only, never `git add -A`, never
`git stash`.
