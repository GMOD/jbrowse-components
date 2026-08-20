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
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ x, y, w, h })
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

test('a stub sits on the query axis at the alignment position', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([[100, 400]]) })
  expect(rects).toEqual([{ x: 10, y: 0, w: 30, h: OFFSCREEN_MATE_HEIGHT_PX }])
})

// The whole risk in the feature: a mark spanning the band asserts an alignment
// to whatever sits directly under it, which is what these do NOT know.
test('a stub stops well short of the far row', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([[100, 400]]) })
  expect(rects[0]!.h).toBeLessThan(params.height / 2)
})

test('and takes at most a third of a band too short for its full height', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    height: 9,
    data: data([[100, 400]]),
  })
  expect(rects[0]!.h).toBe(3)
})

test('the pan offset moves it, as it moves a ribbon', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    offsetPx: 5,
    data: data([[100, 400]]),
  })
  expect(rects[0]!.x).toBe(5)
})

test('a sub-pixel alignment is still a mark', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([[100, 101]]) })
  expect(rects[0]!.w).toBe(MIN_OFFSCREEN_MATE_WIDTH_PX)
})

test('one off each side of the window is skipped, the one between is not', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    data: data([
      [0, 50],
      [400, 500],
      [20000, 20100],
    ]),
  })
  expect(rects).toHaveLength(2)
  expect(rects.map(r => r.x)).toEqual([0, 40])
})

test('nothing to say draws nothing', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([]) })
  expect(rects).toHaveLength(0)
})

test('a collapsed band draws nothing rather than a zero-height row', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, height: 0, data: data([[100, 400]]) })
  expect(rects).toHaveLength(0)
})

test('the alignment-length floor hides a stub the ribbons would also hide', () => {
  const { ctx, rects } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    minAlignmentLength: 200,
    data: data([
      [100, 400],
      [1000, 1100],
    ]),
  })
  expect(rects).toHaveLength(1)
  expect(rects[0]!.x).toBe(10)
})

test('a stub wide enough carries the contig it points at', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([[0, 1000]], ['ctgB']) })
  expect(texts).toEqual([{ text: 'ctgB', x: 38, y: 16 }])
})

// The reason it is a fit test and not a count threshold: the stub that cannot
// hold its name is the one whose neighbours would have overprinted it.
test('a stub too narrow for the name goes unlabelled, and still drawn', () => {
  const { ctx, rects, texts } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([[100, 300]], ['ctgB']) })
  expect(rects).toHaveLength(1)
  expect(texts).toEqual([])
})

test('a run of stubs to one contig says its name once, not per stub', () => {
  const { ctx, texts } = fakeCtx()
  drawOffscreenMates(ctx, {
    ...params,
    data: data(
      [
        [0, 1000],
        [1000, 2000],
      ],
      ['ctgB', 'ctgB'],
    ),
  })
  expect(texts).toHaveLength(1)
})

test('the hit test answers the contig under the pointer', () => {
  const layout = { ...params, data: data([[100, 400]], ['ctgB']) }
  expect(offscreenMateAt(layout, 20, 3)?.refName).toBe('ctgB')
})

// Draw and hit test read one layout, so this is the shape the bug cannot take —
// pinned anyway, because a second code path here is the obvious "optimization".
test('every drawn stub is hittable at its own left edge', () => {
  const { ctx, rects } = fakeCtx()
  const layout = {
    ...params,
    data: data(
      [
        [0, 200],
        [400, 900],
      ],
      ['ctgB', 'ctgC'],
    ),
  }
  drawOffscreenMates(ctx, layout)
  expect(rects).toHaveLength(2)
  for (const r of rects) {
    expect(offscreenMateAt(layout, r.x + 0.5, 1)).toBeDefined()
  }
})

test('below the stub is not a hit, which is where the ribbons are', () => {
  const layout = { ...params, data: data([[100, 400]], ['ctgB']) }
  expect(
    offscreenMateAt(layout, 20, OFFSCREEN_MATE_HEIGHT_PX + 1),
  ).toBeUndefined()
})

// ...and it answers that without looking at one. The strip is a few pixels of a
// band ~100 tall, so nearly every pointer position asked about is below it, and
// this runs ahead of the ribbon pick on every hover frame. Laying out the level
// first to answer "no" made a hover cost 6.4ms on a 50k-stub level; the
// rejection is what makes it independent of how much the level fetched, and it
// is a property a rewrite loses while every other test here stays green.
test('a hover below the strip reads no alignment at all', () => {
  const layout = { ...params, data: data([[100, 400]], ['ctgB']) }
  let reads = 0
  const watched = {
    ...layout,
    data: {
      ...layout.data,
      starts: new Proxy(layout.data.starts, {
        get(target, prop) {
          if (typeof prop === 'string' && /^\d+$/.test(prop)) {
            reads++
          }
          return (target as unknown as Record<string, unknown>)[prop as string]
        },
      }),
    },
  }
  expect(
    offscreenMateAt(watched, 20, OFFSCREEN_MATE_HEIGHT_PX + 1),
  ).toBeUndefined()
  expect(reads).toBe(0)
  // and the counter counts, so the zero above is a fact rather than a broken probe
  offscreenMateAt(watched, 20, 3)
  expect(reads).toBeGreaterThan(0)
})

test('beside every stub is not a hit', () => {
  const layout = { ...params, data: data([[100, 400]], ['ctgB']) }
  expect(offscreenMateAt(layout, 60, 3)).toBeUndefined()
})

test('a stub the length floor hid is not hittable either', () => {
  const layout = {
    ...params,
    minAlignmentLength: 500,
    data: data([[100, 400]], ['ctgB']),
  }
  expect(offscreenMateAt(layout, 20, 3)).toBeUndefined()
})

// Overlapping stubs: the canvas paints later over earlier, so the answer has to
// be the one the reader can see.
test('where two overlap, the hit is the one drawn on top', () => {
  const layout = {
    ...params,
    data: data(
      [
        [100, 400],
        [150, 350],
      ],
      ['ctgB', 'ctgC'],
    ),
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
    data: data(
      [
        [0, 1000],
        [8000, 9000],
      ],
      ['ctgB', 'ctgB'],
    ),
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
    data: data(
      [
        [8000, 9000],
        [0, 1000],
      ],
      ['ctgB', 'ctgB'],
    ),
  })
  expect(texts.map(t => t.x)).toEqual([38, 838])
})

// Grey-on-anything: the label sits below the stub, over whatever the renderer
// painted. Without the halo it is legible on a white band and invisible on a
// pale ribbon, which is the state every fixture here is in — so this pins the
// stroke rather than trusting the picture.
test('a label is haloed before it is filled', () => {
  const { ctx, texts, strokes } = fakeCtx()
  drawOffscreenMates(ctx, { ...params, data: data([[0, 1000]], ['ctgB']) })
  expect(strokes).toEqual(texts)
  expect(strokes).toHaveLength(1)
})

// The export runs this same function against SvgCanvas rather than a real
// context, which is the first draw path in the repo to call `ctx.measureText`
// (see SvgCanvas's own note on it) — so a missing method here is a figure with
// no stubs in it, and nothing else would report that.
test('the same draw emits stubs and labels through SvgCanvas', () => {
  const svg = new SvgCanvas()
  drawOffscreenMates(svg, {
    ...params,
    width: 1000,
    data: data([[0, 1000]], ['ctgB']),
  })
  const out = svg.getSerializedSvg()
  expect(out).toContain('<rect')
  // haloed: the stroked copy under the filled one, as on screen
  expect(out.match(/<text/g)).toHaveLength(2)
  expect(out).toContain('ctgB')
})
