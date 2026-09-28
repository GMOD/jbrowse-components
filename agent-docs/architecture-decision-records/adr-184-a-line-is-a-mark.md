---
status: Accepted
summary: "render-core gains a `line` shape in two modules, `lineStepMark` (28 bytes an instance: the previous and next values) and `lineCenterMark` (32 bytes: the previous span and value), over `lineCommon`'s one uniform block; the mark display draws `mark: 'line'` through them, `interpolate: 'step' | 'linear'` choosing the module and `encoding.size` the width. ADR-127 declined the same shape because wiggle was not its second consumer; Colin's 2026-09-27 decision to move wiggle onto the mark display makes it one, and the shape lands ahead of the port because the port is what it is for. Colour is per instance for now: the pos/neg split along a rise is the shader-side threshold over the value lane, which the port's next stage adds"
---

# ADR-184: A line is a mark

## Status

Accepted (2026-09-28). Supersedes
[ADR-127](adr-127-line-stays-wiggles.md), whose spike this revives.

## Context

ADR-127 built a `line` shape, measured it at parity with wiggle's hand-written
step and centre lines (pack 0.96x, paint within 1.12x at a million instances)
and declined it on one ground: wiggle's payload was interleaved positions with
one colour and one row per source, so wiggle porting onto per-instance lanes
would have retained 16 more bytes a feature, and without wiggle the shape had
one consumer. The mark display was left with no line, so a BigWig under
`marks` could draw bars and points and not the picture a quantitative track
is usually read as.

On 2026-09-27 Colin asked why wiggle should not move onto `bar` and `point`,
then said to aim for the ideal implementation, changing dataflow where needed.
That port is the second consumer ADR-127 waited on: wiggle's row becomes a key
the row table places (ADR-165), so a source's colour rides the table and the
per-instance colour lane the ADR counted goes with it. The line is the first
landing of that port, because a quantitative display without one cannot be
rebuilt on the grammar.

## Decision

- **Two entry modules, one uniform block.** `lineStepMark.slang` reads an
  instance's `prevY` and `nextY`, `lineCenterMark.slang` its `prevX`,
  `prevX2` and `prevY`; each reads only the neighbour its variant draws, so
  neither carries the other's fields. `lineCommon.slang` holds the `Uniforms`
  struct both bind, the two sentinels the packer writes (`GAP_Y`,
  `NO_PREV_X`) and where a value lands in its band. Wiggle split its own line
  shaders the same way for the same bytes (`plugins/wiggle/src/CLAUDE.md`).
- **The row is a key through the row table**, as `bar`, `point` and `span`
  read it: a hidden row's instances leave clip space, a colour override paints
  the row, and a rowless caller draws on the canvas as one band.
- **The step joins abutting spans on one row** (`x2[i-1] === x[i]`) and drops
  to `origin` across a gap, its three quads flat-filled so their overlaps do
  not double-blend. **The linear variant links an instance to the previous
  one on its row within `gapBp`**, a channel the caller stamps per payload so
  both backends break a run in the same place; absent, a row is one run. Its
  capsules union under a max blend with analytic coverage, as wiggle's centre
  line did.
- **`mark: 'line'` on the mark display**, `interpolate` a mark slot with the
  wiggle display's two values, `encoding.size` the stroke width defaulting to
  1 px, `y` required, colour a constant, a categorical scale or a ramp. The
  rule list gains `unread-interpolate` beside `unread-link-shape`.
- **Ink is the instance's own strokes**: the step's rise, top and drop, the
  linear variant's segment from the previous midpoint or its dot. The hit
  test derives from it (ADR-110).

## Consequences

- A line's colour is one colour per instance. Wiggle colours a line by the
  band its centre line is in, so a rise across the pivot changes colour
  mid-stroke; that is the shader-side threshold over the value lane, which the
  port's next stage gives every valued shape, and until then a two-colour line
  on the mark display is two marks with a `filter` each.
- The mark display's `marks_line` scene joins the cross-backend gate. Its
  goldens land with the first CI run.
- ADR-127's bench (`git show 07de7c5cef:packages/render-core/benches/lineMark.bench.ts`)
  measured the spike; the port's own benches re-measure the shape against
  wiggle's packers at the port.

## Rejected alternatives

- **One module with a `variant` uniform**, the spike's shape: 40 bytes an
  instance, 12 of them the fields the other variant reads.
- **Waiting for the port to land the shape with it.** The port is several
  landings, and a mark display that can draw a line is useful on its own.
