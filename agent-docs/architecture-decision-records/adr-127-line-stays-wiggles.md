---
status: Rejected
summary: "No render-core `line` shape: a step-and-centre `lineMark` generalising `wiggleLine.slang` over the mark uniforms and the row lane packed at parity with wiggle's hand path (0.96x at a million instances) and painted within 1.1x, but wiggle porting onto it would retain 16 more bytes a feature per region on its stroked renderings, since its payload is interleaved positions with a colour and a row per source and the shape's channels are per-instance lanes. The shape needs wiggle as its second consumer (ADR-040), so the step line and the centre line stay wiggle's, and the mark display exposes no `shape: 'line'`"
---

# ADR-127: The line stays wiggle's

## Status

Rejected (2026-09-16). The last step of the 2026-09-16 grammar handoff, which
named its own kill: the port slower than the hand path, or the neighbour lane
costing more than the shape saves. The spike is the commit "render-core: a
line mark shape, step and centre, with the bench that holds it to wiggle's
hand path" (`07de7c5cef`), reverted by the commit that adds this file; check
it out to re-run `packages/render-core/benches/lineMark.bench.ts`.

## Context

The mark layer has `bar`, `point` and `span`. Wiggle's step line and centre
line, with their bp gap rules, have no shape. A render-core `lineMark` would
be the fourth, and the one rendering wiggle would consume as the second user
[ADR-040](adr-040-no-genome-quad-vertex-helper.md) asks of a shared shader
module. The shape was built to find out: `lineMark.slang` is `wiggleLine.slang`
over the mark family's uniforms (`domain`, `valueScaleType`, the ramp,
`rowHeight` from [ADR-126](adr-126-a-row-lane-on-bar-and-point.md), `origin`,
a `variant`), a 40-byte record carrying both variants' neighbour fields, and
`lineMark.ts` derives those fields from split `x`/`x2`/`y`/`row` channels and
paints both variants over them.

## What the bench said

One block, one row, tiling 10 bp spans with a hole every fiftieth, on AC
power, `--no-use-osr`, min of 9 to 25 interleaved rounds, ratio to wiggle's
own code copied verbatim, the control a second copy of it. Identity held on
every instance and every path point in both orientations.

| arm                            | 100,000 | 1,000,000 |
| ------------------------------ | ------: | --------: |
| pack, control                  |   0.99x |     1.00x |
| pack, ported (both variants)   |   1.18x |     0.96x |
| pack, the lens alone           |   0.10x |     0.10x |
| step paint, control            |   1.01x |     1.00x |
| step paint, ported             |   1.08x |     1.12x |
| centre paint, control          |   0.98x |     0.98x |
| centre paint, ported           |   1.08x |     1.09x |

The ported pack fills both variants' neighbour fields in one pass and is
measured against wiggle's two, so 0.96x is parity. The painters' 8 to 12
percent is the per-instance colour read the shape's channels carry and the
row branch; the retired arm is wiggle's constant-colour path, and its own
per-instance colour path pays the same read. Two costs the first painter had
were harness lessons, not the shape's: identity run before timing put two
context shapes through the retired painters and read them at 2x their
control, and a frame object returned from a call is reloaded per instance
(`benches/placeWalkers.bench.ts` says the same).

## Decision

**The shape does not land, and line stays wiggle's.** Speed was not the
kill; the lens was. Wiggle's payload is one interleaved `featurePositions`
array per source with the colour and the row on the source, and the shape
reads `x`, `x2`, `color` and `row` per instance. The `lens` row is the split
alone, 2 to 4 ns an instance; what it retains is the cost — `x`, `x2`, a
colour lane and a row lane are 16 bytes a feature held per region beside the
40-byte record, on the two stroked renderings, where the fill record was cut
to 20 bytes precisely so a thousand-source multi-wiggle would not carry
neighbour fields it does not read (`plugins/wiggle/CLAUDE.md`). A lens that
allocates per frame instead would re-split every draw. With wiggle out, the
shape has one consumer, and the mark display does not take a `line` on that
footing.

## Consequences

- `shape: 'line'` is not a mark. A wiggle track's line renderings are the
  track menu's, as they were.
- The shape's geometry — one shader for both variants, the row band, the
  origin drop, the `GAP_Y` and `NO_PREV_X` sentinels a packer writes for the
  neighbour it does not have — is in the spike commit for the day wiggle's
  payload is per-instance lanes, which is what would make it the second
  consumer for free.
- The bench's two harness lessons apply to any port measured against a
  verbatim copy: run identity after timing, and destructure a returned frame
  into locals before the loop.

## Rejected alternatives

- **Widen the channel contract for wiggle** — a constant colour beside the
  colour lane, a row offset in the params, interleaved positions as a
  channel. Each one is a second spelling of a lane so one consumer can skip
  copying into the first, and the encoder, the hit test and every other
  shape read the first.
- **Land the shape for the mark display alone.** `span` has one consumer
  today, so the precedent exists, but the handoff took wiggle's port as the
  reason for the shape and the mark display has no track whose picture needs
  a line that a bar does not draw; a feature adapter's scores are bars, and a
  BigWig's line is wiggle's.
- **Keep the shape in the tree, unexposed, for the bench.** A shader and a
  shape with no consumer is what `moduleClosure.test.ts` and the exports map
  exist to refuse; the commit is the record.
