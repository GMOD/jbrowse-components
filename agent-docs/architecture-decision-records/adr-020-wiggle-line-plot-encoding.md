# ADR-020: Wiggle line-plot single-polyline encoding

## Status

Accepted

## Context

Wiggle line plots are step plots: each feature `[startBp, endBp]` with score
`s` is drawn as a horizontal segment at Y = scoreToY(s) spanning x1→x2, with
vertical steps connecting adjacent features. Where there's a gap between
features (no data in between), the line drops to zero at the right edge of the
gap-before feature and rises from zero at the left edge of the gap-after
feature, so visual gaps look like missing data, not interpolation.

Two render paths must agree:

- **Canvas2D** (`Canvas2DWiggleRenderer.drawLine`) — used on machines without
  GPU, in tests, and in SVG export.
- **GPU shader** (`wiggle.slang`, `PASS_LINE` topology=line-list, fed by
  `wiggleInstanceBuffer.interleaveInstances`) — used on screen by default.

The GPU path can't loop across features; each instance emits 6 vertices (3
line-list segments) and only sees its own data plus per-instance fields.
That constrains the encoding.

## Decision

### Single-polyline rendering model (Canvas2D)

`drawLine` emits **one connected polyline per contiguous run of features**.
Inside a run, `lineTo` does all the work — the implicit pen continuation
between iterations draws the vertical step at each junction. The pen lifts
(`moveTo`) only at the start of a new disjoint run.

For a run of features f₀, f₁, …, fₙ:

```
moveTo(x1₀, zeroY)       // anchor at zero (rise-from-zero start)
lineTo(x1₀, scoreY₀)     // rise
lineTo(x2₀, scoreY₀)     // horizontal across f₀
lineTo(x1₁, scoreY₁)     // implicit vertical step at junction (x2₀ == x1₁)
lineTo(x2₁, scoreY₁)     // horizontal across f₁
…
lineTo(x2ₙ, zeroY)       // drop to zero (final segment of the run)
```

A `gapAfter` boundary closes the run with `lineTo(x2, zeroY)` and the next
feature starts a new run with another `moveTo(x1, zeroY)`. An isolated
feature gets `1 moveTo + 3 lineTo` (rise, horizontal, drop).

### Per-instance encoding (GPU)

Each `WiggleInstance` carries `prevScore` and `nextScore` so the shader can
emit the rise-at-left and drop-at-right segments without seeing neighbors:

```
prevScore = prevAdj ? scores[i-1] : 0     // 0 ⇒ rise-from-zero at left edge
nextScore = nextAdj ? score       : 0     // 0 ⇒ drop-to-zero at right edge
```

`prevAdj` / `nextAdj` are computed from `featurePositions[i-1].end ==
featurePositions[i].start` and the matching test on the right.

The shader emits the 6-vertex line-list:

- **v0–v1**: vertical at x1 from `clipPrevY` → `clipScoreY`
  Rise-from-zero when `prevScore=0`; degenerate (0-length) when `prevScore=score`.
- **v2–v3**: horizontal at scoreY from x1 → x2.
- **v4–v5**: vertical at x2 from `clipScoreY` → `clipNextY`
  Drop-to-zero when `nextScore=0`; degenerate when `nextScore=score`.

`nextScore = score` (current score) — not `scores[i+1]` — because at the
right edge of an adjacent feature the *next* instance's `v0–v1` segment
draws the actual transition vertical; the current instance's `v4–v5` only
needs to be a no-op there.

### Contract

Both paths must agree that:

| Boundary             | Canvas2D                              | Shader                       |
| -------------------- | ------------------------------------- | ---------------------------- |
| First feature        | `moveTo(x1, zeroY); lineTo(x1, scoreY)` | `prevScore=0` → `v0–v1` rises |
| Adjacent left edge   | implicit (pen continues from prev)    | `prevScore=scores[i-1]`      |
| Adjacent right edge  | implicit (next iteration's `lineTo`)  | `nextScore=score` (degenerate)|
| Gap right edge       | `lineTo(x2, zeroY)`                   | `nextScore=0` → `v4–v5` drops |
| Last feature         | `lineTo(x2, zeroY)`                   | `nextScore=0` → `v4–v5` drops |

Tests in `Canvas2DWiggleRenderer.test.ts` lock the Canvas behavior;
`gpuWiggleRenderer.test.ts` (using the slang-codegen `FIELD_OFFSET_F32` map)
locks the per-instance encoding.

## Why `nextScore = score` is intentional

The naïve reading is "next score should be `scores[i+1]`." That would also
work — but it'd duplicate the next-feature's transition with the next
instance's `v0–v1`, doubling the visual line at every junction.

Setting `nextScore = score` makes the right-edge segment degenerate so only
one transition is drawn (by the next instance). The field name is a slight
lie — it's really "the Y at the right edge" — but renaming it would require
a coordinated shader+codegen+JS change. See task #16 backlog.

## Consequence: each region renders independently

Both paths process one region's feature array as a single closed polyline
(or polyline-set). Crossing a region boundary always looks like a `gapAfter`
to the worker that produced the previous region. Fix would require the
upload lifecycle to pass the trailing score of the previous adjacent region
into the next region's first instance — non-trivial because regions in
`rpcDataMap` aren't always genome-contiguous (multi-region views, reversed
strands, etc.). Tracked but not fixed.

## Score==0 edge case

If a feature's actual score is 0, the encoding can't distinguish "real zero"
from "gap" (`prevScore=0`/`nextScore=0` is also the gap sentinel). It happens
to be visually correct — both produce a line segment ending at `zeroY`,
which is where a true-zero score should sit anyway. So the overload is
benign, just a footgun for anyone reading the buffer code without this ADR.
