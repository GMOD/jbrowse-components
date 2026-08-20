import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import {
  MIN_OFFSCREEN_MATE_WIDTH_PX,
  OFFSCREEN_MATE_HEIGHT_PX,
  drawOffscreenMates,
  offscreenMateAt,
} from './drawOffscreenMates.ts'

import type { OffscreenMateData } from '../LinearSyntenyRPC/collectOffscreenMates.ts'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// One char is 6px wide here, which is enough to make "does the label fit"
// deterministic without a real text engine.
const CHAR_PX = 6

function fakeCtx() {
  const rects: Rect[] = []
  const texts: { text: string; x: number; y: number }[] = []
  const strokes: { text: string; x: number; y: number }[] = []
  // Recorded on fill(), not on rect(), so a path built and never filled records
  // nothing — which is the whole failure mode of drawing the strip as one path.
  let pending: Rect[] = []
  return {
    rects,
    texts,
    strokes,
    ctx: {
      fillStyle: '',
      strokeStyle: '',
      font: '',
      textBaseline: '',
      lineWidth: 0,
      lineJoin: '',
      beginPath() {
        pending = []
      },
      rect(x: number, y: number, w: number, h: number) {
        pending.push({ x, y, w, h })
      },
      fill() {
        rects.push(...pending)
        pending = []
      },
      fillText(text: string, x: number, y: number) {
        texts.push({ text, x, y })
      },
      strokeText(text: string, x: number, y: number) {
        strokes.push({ text, x, y })
      },
      measureText(text: string) {
        return { width: text.length * CHAR_PX }
      },
    } as unknown as CanvasRenderingContext2D,
  }
}

function data(
  spans: [number, number][],
  names: string[] = spans.map(() => 'other'),
): OffscreenMateData {
  const dict = [...new Set(names)]
  return {
    mateRefNameDict: dict,
    counts: Uint32Array.from(dict, () => spans.length),
    starts: Float64Array.from(spans.map(s => s[0])),
    ends: Float64Array.from(spans.map(s => s[1])),
    mateRefNameIds: Uint32Array.from(names, n => dict.indexOf(n)),
  }
}

const params = {
  bpPerPx: 10,
  offsetPx: 0,
  width: 100,
  height: 50,
  color: 'red',
  haloColor: 'white',
}

test('a mark sits on the query axis at the alignment position', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, datasets: [data([[100, 400]])] })
  expect(rects).toEqual([{ x: 10, y: 0, w: 30, h: OFFSCREEN_MATE_HEIGHT_PX }])
})

// The whole risk in the feature: a mark spanning the band asserts an alignment
// to whatever sits directly under it, which is what these do NOT know.
test('a mark stops well short of the far row', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, datasets: [data([[100, 400]])] })
  expect(rects[0]!.h).toBeLessThan(params.height / 2)
})

test('and takes at most a third of a band too short for its full height', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    height: 9,
    datasets: [data([[100, 400]])],
  })
  expect(rects[0]!.h).toBe(3)
})

test('the pan offset moves it, as it moves a ribbon', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    offsetPx: 5,
    datasets: [data([[100, 400]])],
  })
  expect(rects[0]!.x).toBe(5)
})

test('a sub-pixel alignment is still a mark', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, datasets: [data([[100, 101]])] })
  expect(rects[0]!.w).toBe(MIN_OFFSCREEN_MATE_WIDTH_PX)
})

test('one off each side of the window is skipped, the one between is not', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    datasets: [
      data([
        [0, 50],
        [400, 500],
        [20000, 20100],
      ]),
    ],
  })
  expect(rects).toHaveLength(2)
  expect(rects.map(r => r.x)).toEqual([0, 40])
})

test('nothing to say draws nothing', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, datasets: [data([])] })
  expect(rects).toHaveLength(0)
})

test('a collapsed band draws nothing rather than a zero-height row', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    height: 0,
    datasets: [data([[100, 400]])],
  })
  expect(rects).toHaveLength(0)
})

test('the alignment-length floor hides a mark the ribbons would also hide', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    minAlignmentLength: 200,
    datasets: [
      data([
        [100, 400],
        [1000, 1100],
      ]),
    ],
  })
  expect(rects).toHaveLength(1)
  expect(rects[0]!.x).toBe(10)
})

test('a mark wide enough carries the contig it points at', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    datasets: [data([[0, 1000]], ['ctgB'])],
  })
  expect(texts).toEqual([{ text: 'ctgB', x: 38, y: 16 }])
})

// The reason it is a fit test and not a count threshold: the mark that cannot
// hold its name is the one whose neighbours would have overprinted it.
test('a mark too narrow for the name goes unlabelled, and still drawn', () => {
  const { ctx, rects, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    datasets: [data([[100, 300]], ['ctgB'])],
  })
  expect(rects).toHaveLength(1)
  expect(texts).toEqual([])
})

test('a run of marks to one contig says its name once, not per mark', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    datasets: [
      data(
        [
          [0, 1000],
          [1000, 2000],
        ],
        ['ctgB', 'ctgB'],
      ),
    ],
  })
  expect(texts).toHaveLength(1)
})

// Zooming into a block is enough to reach this: the stretch then runs past both
// edges, its own midpoint is off screen, and the contig the whole window maps to
// was the one contig never named. The fit test read that off-screen width too,
// so the label passed it and drew where nothing could show it.
test('a stretch wider than the window is named inside the window', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    datasets: [data([[0, 100000]], ['ctgB'])],
  })
  expect(texts).toHaveLength(1)
  expect(texts[0]!.x).toBeGreaterThanOrEqual(0)
  expect(texts[0]!.x + 'ctgB'.length * CHAR_PX).toBeLessThanOrEqual(
    params.width,
  )
})

// One edge is the same bug: a stretch starting off the left is centred left of
// where the reader can see, by half of whatever fell off.
test('a stretch running off one edge is named over the part in view', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    offsetPx: 50,
    datasets: [data([[0, 1000]], ['ctgB'])],
  })
  // 0..1000bp at 10bp/px panned 50px is -50..50, so the visible half is 0..50
  expect(texts).toEqual([{ text: 'ctgB', x: 13, y: 16 }])
})

// ...and the fit test is asked about the same part, so a stretch with only a
// sliver in view goes unlabelled rather than carrying a name wider than it.
test('a stretch with only a sliver in view goes unlabelled', () => {
  const { ctx, rects, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    offsetPx: 95,
    datasets: [data([[0, 1000]], ['ctgB'])],
  })
  expect(rects).toHaveLength(1)
  expect(texts).toEqual([])
})

test('the hit test answers the contig under the pointer', () => {
  const layout = { ...params, datasets: [data([[100, 400]], ['ctgB'])] }
  expect(offscreenMateAt(layout, 20, 3)?.refName).toBe('ctgB')
})

// What the tooltip reports for the mark under the pointer: the per-contig tally
// the menu's headline is summed from, not the number of marks drawn.
test('the hit carries how many alignments go to that contig', () => {
  const layout = { ...params, datasets: [data([[100, 400]], ['ctgB'])] }
  expect(offscreenMateAt(layout, 20, 3)?.count).toBe(1)
})

// Draw and hit test read one layout, so this is the shape the bug cannot take —
// pinned anyway, because a second code path here is the obvious "optimization".
test('every drawn mark is hittable at its own left edge', () => {
  const { ctx, rects } = fakeCtx()
  const layout = {
    ...params,
    datasets: [
      data(
        [
          [0, 200],
          [400, 900],
        ],
        ['ctgB', 'ctgC'],
      ),
    ],
  }
  drawOffscreenMates(ctx, layout)
  expect(rects).toHaveLength(2)
  for (const r of rects) {
    expect(offscreenMateAt(layout, r.x + 0.5, 1)).toBeDefined()
  }
})

test('below the mark is not a hit, which is where the ribbons are', () => {
  const layout = { ...params, datasets: [data([[100, 400]], ['ctgB'])] }
  expect(
    offscreenMateAt(layout, 20, OFFSCREEN_MATE_HEIGHT_PX + 1),
  ).toBeUndefined()
})

// ...and it answers that without looking at one. The strip is a few pixels of a
// band ~100 tall, so nearly every pointer position asked about is below it, and
// this runs ahead of the ribbon pick on every hover frame. Laying out the level
// first to answer "no" made a hover cost 6.4ms on a 50k-mark level; the
// rejection is what makes it independent of how much the level fetched, and it
// is a property a rewrite loses while every other test here stays green.
test('a hover below the strip reads no alignment at all', () => {
  const only = data([[100, 400]], ['ctgB'])
  let reads = 0
  const watched = {
    ...params,
    datasets: [
      {
        ...only,
        starts: new Proxy(only.starts, {
          get(target, prop) {
            if (typeof prop === 'string' && /^\d+$/.test(prop)) {
              reads++
            }
            return (target as unknown as Record<string, unknown>)[
              prop as string
            ]
          },
        }),
      },
    ],
  }
  expect(
    offscreenMateAt(watched, 20, OFFSCREEN_MATE_HEIGHT_PX + 1),
  ).toBeUndefined()
  expect(reads).toBe(0)
  // and the counter counts, so the zero above is a fact rather than a broken probe
  offscreenMateAt(watched, 20, 3)
  expect(reads).toBeGreaterThan(0)
})

test('beside every mark is not a hit', () => {
  const layout = { ...params, datasets: [data([[100, 400]], ['ctgB'])] }
  expect(offscreenMateAt(layout, 60, 3)).toBeUndefined()
})

test('a mark the length floor hid is not hittable either', () => {
  const layout = {
    ...params,
    minAlignmentLength: 500,
    datasets: [data([[100, 400]], ['ctgB'])],
  }
  expect(offscreenMateAt(layout, 20, 3)).toBeUndefined()
})

// Overlapping marks: the canvas paints later over earlier, so the answer has to
// be the one the reader can see.
test('where two overlap, the hit is the one drawn on top', () => {
  const layout = {
    ...params,
    datasets: [
      data(
        [
          [100, 400],
          [150, 350],
        ],
        ['ctgB', 'ctgC'],
      ),
    ],
  }
  expect(offscreenMateAt(layout, 20, 3)?.refName).toBe('ctgC')
})

// The merge is per stretch, not per contig: grape chr5 syntenic to two separate
// peach segments is two things a reader wants pointed at, not one.
test('one contig in two separate places is named in both', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    width: 1000,
    datasets: [
      data(
        [
          [0, 1000],
          [8000, 9000],
        ],
        ['ctgB', 'ctgB'],
      ),
    ],
  })
  expect(texts.map(t => t.x)).toEqual([38, 838])
})

// Draw order is the adapter's, which says nothing about position, so the merge
// sorts before it walks. Same two stretches, handed over back to front.
test('the stretches are found whatever order the anchors arrived in', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    width: 1000,
    datasets: [
      data(
        [
          [8000, 9000],
          [0, 1000],
        ],
        ['ctgB', 'ctgB'],
      ),
    ],
  })
  expect(texts.map(t => t.x)).toEqual([38, 838])
})

// Grey-on-anything: the label sits below the mark, over whatever the renderer
// painted. Without the halo it is legible on a white band and invisible on a
// pale ribbon, which is the state every fixture here is in — so this pins the
// stroke rather than trusting the picture.
test('a label is haloed before it is filled', () => {
  const { ctx, texts, strokes } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    datasets: [data([[0, 1000]], ['ctgB'])],
  })
  expect(strokes).toEqual(texts)
  expect(strokes).toHaveLength(1)
})

// The export runs this same function against SvgCanvas rather than a real
// context, which is the first draw path in the repo to call `ctx.measureText`
// (see SvgCanvas's own note on it) — so a missing method here is a figure with
// no marks in it, and nothing else would report that.
test('the same draw emits marks and labels through SvgCanvas', () => {
  const svg = new SvgCanvas()
  drawOffscreenMates(svg, {
    ...params,
    width: 1000,
    datasets: [data([[0, 1000]], ['ctgB'])],
  })
  const out = svg.getSerializedSvg()
  // one path for the whole strip, not a <rect> per alignment
  expect(out).toContain('<path')
  expect(out).not.toContain('<rect')
  // haloed: the stroked copy under the filled one, as on screen
  expect(out.match(/<text/g)).toHaveLength(2)
  expect(out).toContain('ctgB')
})

// The case the whole feature exists for is one query segment with SEVERAL
// counterparts — peach chr1 has about three grape chromosomes over each of its
// segments — so those stretches cover the same pixels by construction. On one
// baseline they land within a few pixels of each other and the last one's halo
// erases the two before it, which is a figure naming one contig where three
// apply, with nothing to say two are missing.
function interleaved(contigs: string[], n = 300) {
  const spans: [number, number][] = []
  const names: string[] = []
  for (let i = 0; i < n; i++) {
    spans.push([i * 1000, i * 1000 + 900])
    names.push(contigs[i % contigs.length]!)
  }
  return data(spans, names)
}

test('three contigs over one stretch are named on three rows, not one', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    bpPerPx: 300,
    width: 1500,
    height: 100,
    datasets: [interleaved(['ctgAAA', 'ctgBBB', 'ctgCCC'])],
  })
  expect(texts.map(t => t.text).sort()).toEqual(['ctgAAA', 'ctgBBB', 'ctgCCC'])
  expect(new Set(texts.map(t => t.y)).size).toBe(3)
})

// ...and a fourth has nowhere left to go, so it is dropped rather than drawn
// over a name already there.
test('a stretch with no free row goes unlabelled', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    bpPerPx: 300,
    width: 1500,
    height: 100,
    datasets: [interleaved(['ctgAAA', 'ctgBBB', 'ctgCCC', 'ctgDDD'])],
  })
  expect(texts).toHaveLength(3)
  const boxes = texts.map(t => ({ ...t, w: t.text.length * CHAR_PX }))
  for (const a of boxes) {
    for (const b of boxes) {
      if (a !== b && a.y === b.y) {
        expect(a.x >= b.x + b.w || b.x >= a.x + a.w).toBe(true)
      }
    }
  }
})

// A compact band has no room to stack into, and the rows must not run past it
// into the view below.
test('a short band keeps the labels on one row', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    bpPerPx: 300,
    width: 1500,
    height: 18,
    datasets: [interleaved(['ctgAAA', 'ctgBBB', 'ctgCCC'])],
  })
  expect(new Set(texts.map(t => t.y)).size).toBe(1)
  expect(texts).toHaveLength(1)
})

// TWO SYNTENY TRACKS ON ONE LEVEL PAINT ONE STRIP. Placed per display, each
// starts again at the first row and their names land on top of each other —
// which is the defect `placeLabels` exists to prevent, arriving through the
// caller's loop instead of through the geometry.
test('two displays over one stretch are named on two rows, not one', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    width: 1000,
    datasets: [data([[0, 1000]], ['ctgB']), data([[0, 1000]], ['ctgC'])],
  })
  expect(texts.map(t => t.text)).toEqual(['ctgB', 'ctgC'])
  expect(new Set(texts.map(t => t.y)).size).toBe(2)
})

// ...and the same reason the single-display scan runs backwards: the second
// display's marks are painted over the first's.
test('where two displays overlap, the hit is the one drawn on top', () => {
  const layout = {
    ...params,
    datasets: [data([[100, 400]], ['ctgB']), data([[150, 350]], ['ctgC'])],
  }
  expect(offscreenMateAt(layout, 20, 3)?.refName).toBe('ctgC')
})

// A band with no room for the first baseline gets no labels rather than a row
// drawn past its bottom edge, which only the canvas and the export clip were
// keeping out of the view below.
test('a band too short for a baseline is marks alone', () => {
  const { ctx, rects, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    height: 12,
    width: 1000,
    datasets: [data([[0, 1000]], ['ctgB'])],
  })
  expect(rects).toHaveLength(1)
  expect(texts).toEqual([])
})

// The mirror strip: the alignments anchored on the TARGET row whose query end is
// on a contig the row above is not showing. Same geometry against the other
// row's ruler, hanging off the other edge — and it has to STOP short of the row
// below it for the same reason the query strip does, in the other direction.
test('a target-axis mark hangs off the bottom edge', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    side: 'bottom',
    datasets: [data([[100, 400]])],
  })
  expect(rects).toEqual([
    {
      x: 10,
      y: params.height - OFFSCREEN_MATE_HEIGHT_PX,
      w: 30,
      h: OFFSCREEN_MATE_HEIGHT_PX,
    },
  ])
})

// Above its marks, not below them: a label at the top strip's offset would sit
// in the middle of the band naming marks at the bottom of it.
test('a target-axis label sits above its marks', () => {
  const { ctx, texts, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    side: 'bottom',
    datasets: [data([[0, 1000]], ['ctgB'])],
  })
  expect(texts).toHaveLength(1)
  expect(texts[0]!.y).toBeLessThan(rects[0]!.y)
})

test('the two strips do not overlap in a band they share', () => {
  const { ctx, rects } = fakeCtx()
  const datasets = [data([[100, 400]])]
  drawOffscreenMates(ctx, { ...params, datasets })
  drawOffscreenMates(ctx, { ...params, side: 'bottom', datasets })
  const [top, bottom] = rects
  expect(top!.y + top!.h).toBeLessThan(bottom!.y)
})

test('the hit test answers inside the bottom strip and not above it', () => {
  const layout = {
    ...params,
    side: 'bottom' as const,
    datasets: [data([[100, 400]], ['ctgB'])],
  }
  expect(offscreenMateAt(layout, 20, params.height - 1)?.refName).toBe('ctgB')
  expect(
    offscreenMateAt(layout, 20, params.height - OFFSCREEN_MATE_HEIGHT_PX - 2),
  ).toBeUndefined()
})

// The same rejection the top strip makes, in the other direction: a pointer over
// the ribbons is the overwhelmingly common case and must not lay out a mark to
// find that out.
test('a hover above the bottom strip reads no alignment at all', () => {
  const only = data([[100, 400]], ['ctgB'])
  let reads = 0
  const watched = {
    ...params,
    side: 'bottom' as const,
    datasets: [
      {
        ...only,
        starts: new Proxy(only.starts, {
          get(target, prop) {
            if (typeof prop === 'string' && /^\d+$/.test(prop)) {
              reads++
            }
            return (target as unknown as Record<string, unknown>)[
              prop as string
            ]
          },
        }),
      },
    ],
  }
  expect(offscreenMateAt(watched, 20, 3)).toBeUndefined()
  expect(reads).toBe(0)
  offscreenMateAt(watched, 20, params.height - 1)
  expect(reads).toBeGreaterThan(0)
})

// The zoom this rule exists for. One block of anchors spreads with the zoom, so
// at a 4 Mb window its marks are tens of pixels apart — which a fixed 20px merge
// broke into slivers, none of them wide enough to hold the contig name, and the
// strip then named nothing at all at exactly the zoom a reader asks what they
// are looking at.
test('one block spread across the window is named once rather than not at all', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    width: 1000,
    datasets: [
      data(
        [
          [0, 200],
          [600, 800],
          [1200, 1400],
          [1800, 2000],
        ],
        Array.from({ length: 4 }, () => 'ctgB'),
      ),
    ],
  })
  expect(texts).toEqual([{ text: 'ctgB', x: 88, y: 16 }])
})

// ...and the tolerance is the NAME, not a number of pixels: the same two marks
// at the same distance are one stretch for a name that could not have fitted
// between them and two for a name that could. No fixed gap answers both.
test('the merge tolerance scales with the name it is tolerating a gap for', () => {
  const spans: [number, number][] = [
    [0, 200],
    [800, 1000],
  ]
  const short = fakeCtx()
  drawOffscreenMates(short.ctx, {
    ...params,
    width: 1000,
    datasets: [data(spans, ['ctgB', 'ctgB'])],
  })
  expect(short.texts).toEqual([])

  const long = fakeCtx()
  drawOffscreenMates(long.ctx, {
    ...params,
    width: 1000,
    datasets: [data(spans, ['ctgBBBBBBBBB', 'ctgBBBBBBBBB'])],
  })
  expect(long.texts.map(t => t.text)).toEqual(['ctgBBBBBBBBB'])
})
