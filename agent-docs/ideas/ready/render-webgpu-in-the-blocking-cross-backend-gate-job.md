---
name: render-webgpu-in-the-blocking-cross-backend-gate-job
description: the drift half is done and the hand gate renders webgpu; the CI job needs Firefox Nightly, xvfb and a software WebGPU adapter, steps this repo writes in push.yml
---

# Render webgpu in the blocking cross-backend gate job

The pixels half is done and the hand gate renders webgpu; what is left is a CI
runner with a Firefox Nightly, a display and a software WebGPU adapter. All
three are setup steps this repo writes in `push.yml` on a GitHub-hosted runner,
so nothing outside waits; none of them can be proved from a worktree, only on
a pushed branch.

**The half this entry used to be about is done.** The capture no longer scrolls:
`captureElementPng` measures the element's rect, clips to it, and asserts the
rect across the capture, so the eight over-threshold alignments pairs came back
on their own — 40 pairs, 8 over threshold before and 0 after, max 0.91%, with
every canvas2d-vs-webgl figure in the same runs unchanged to the decimal. No
threshold override. `pnpm test:browser:gate` drops `--skip-webgpu` as of
2026-08-26. Numbers and mechanism:
[reference/CROSS_BACKEND_GATE.md](../../reference/CROSS_BACKEND_GATE.md) §"Alignments
under webgpu" and
[reference/FIGURE_CAPTURE.md](../../reference/FIGURE_CAPTURE.md)
§"The third one".

**What is left is the CI runner, not the pixels.** `pnpm test:browser:gate:ci`
still passes `--skip-webgpu`, so the blocking `cross_backend_gate` job renders
canvas2d and webgl and WebGPU still ships ungated. Three things have to be true
in that job before the flag comes off, and none of them is checkable from a
worktree:

- Firefox Nightly on the runner at `/usr/bin/firefox-nightly`, or
  `FIREFOX_NIGHTLY_PATH` / `--firefox=` pointed at wherever it lands. Neither
  `push.yml` nor `.github/actions/setup` installs a browser other than the
  puppeteer Chrome.
- A display. `runWithRenderingBackend` launches Firefox with `headless: false`
  deliberately, so the job needs xvfb or an equivalent — or a measurement saying
  headless Firefox renders WebGPU identically, which would be the cheaper answer
  if it holds. **This one has a worked precedent in the same file**:
  `linux_electron_e2e` in `push.yml` installs xvfb for exactly this reason, its
  step comment saying the runner "has no X server, and the app is a real window
  even in --headless". Copy that step rather than re-deriving it; the other two
  blockers have no such precedent.
- A WebGPU adapter on a GPU-less runner. `--swiftshader` only ever spoke for
  Chrome's WebGL; Firefox needs its own software path (lavapipe, or whatever
  `dom.webgpu.*` accepts) and a blank adapter fails every webgpu capture rather
  than drifting.

First move: prove it on a branch with the job actually running, and read the
job's own output — a green `cross_backend_gate` that skipped a backend looks
exactly like one that rendered it. The runner prints
`RenderingBackends tested: ...`, which is the line to assert on.
