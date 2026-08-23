---
name: make-the-snapshot-capture-scroll-invariant-then-widen-the-gate-to-webgpu
description: it is `snapshot.ts`, not a shader — attribution is done
metadata:
  area: browser tests
  category: ready
---

# Make the snapshot capture scroll-invariant, then widen the gate to webgpu

Baselining, localization and attribution are all done — see
[reference/CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md) and
[reference/SCREENSHOT_CAPTURE_RACE.md](../reference/SCREENSHOT_CAPTURE_RACE.md).
The drift is pre-existing, it is one 37px strip, the render is correct, and the
strip is app chrome composited into the canvas after `el.screenshot()` scrolled
the element under it in Firefox and not in Chrome.

So the work is in `snapshot.ts`, not in a shader: either size the viewport so the
display needs no scroll, or scroll to a fixed position before capturing, applied
to both sides of every pair. **The canvas rect must be unchanged across the
capture on every backend**, which is the property that was violated. Re-run
`browser-tests/probe-webgpu-coverage.ts` afterwards. Widening the gate to webgpu
is blocked only by this.

**Then re-measure `Alignments Track` and `Alignments Color Schemes` before
widening, not after.** Both block in `CI_GATE_SUITES` today and both hold only
because every gate script passes `--skip-webgpu`; under webgpu they go eight
pairs over threshold, and the cause is this same scroll artifact rather than a
rendering difference, so **do not answer it with a threshold override** — see
[reference/CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md) §"Alignments
under webgpu". No script runs the gate with webgpu in it — `test:browser:gate`
and `test:browser:gate:ci` both pass `--skip-webgpu` — so drop the flag by hand
from `products/jbrowse-web`:
`node browser-tests/runner.ts --backend=all --swiftshader --gate-only`.
