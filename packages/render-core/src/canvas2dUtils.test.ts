import {
  MAX_CANVAS_DIM_PX,
  MAX_DPR,
  bpAtPx,
  devicePxSpan,
  forEachClippedBlock,
  getDpr,
  getPreparedCanvas2D,
  makeBpMapper,
  makeCellLeftMapper,
  spanLeft,
  syncCanvasSize,
  withClip,
} from './canvas2dUtils.ts'

import type { BpRegionBounds } from './renderBlock.ts'

function makeFakeCanvas(ctx: unknown) {
  const calls = { setTransform: 0, clearRect: 0 }
  const fakeCtx = {
    setTransform() {
      calls.setTransform++
    },
    clearRect() {
      calls.clearRect++
    },
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (ctx === undefined ? fakeCtx : ctx),
  }
  return { canvas, fakeCtx, calls }
}

test('returns null when the canvas ref is null', () => {
  expect(getPreparedCanvas2D(null, 100, 20)).toBeNull()
})

test('returns null when getContext yields null', () => {
  const { canvas } = makeFakeCanvas(null)
  expect(
    getPreparedCanvas2D(canvas as unknown as HTMLCanvasElement, 100, 20),
  ).toBeNull()
})

test('returns the prepared context and applies the DPR backing-store sizing', () => {
  const { canvas, fakeCtx, calls } = makeFakeCanvas(undefined)
  const ctx = getPreparedCanvas2D(
    canvas as unknown as HTMLCanvasElement,
    100,
    20,
  )
  expect(ctx).toBe(fakeCtx)
  // prepareCanvas ran: backing store sized to CSS * dpr (dpr=1 in jsdom) and
  // the transform/clear were applied.
  expect(canvas.width).toBe(100)
  expect(canvas.height).toBe(20)
  expect(calls.setTransform).toBe(1)
  expect(calls.clearRect).toBe(1)
})

test('devicePxSpan edge-rounds so the right edge never exceeds round(cssEnd*dpr)', () => {
  // width-rounding round(3*1.5)=5 gives right edge 1496+5=1501; edge-rounding
  // pins it to round(1000*1.5)=1500.
  expect(devicePxSpan(997, 1000, 1.5)).toEqual({ start: 1496, width: 4 })
})

test('devicePxSpan produces abutting spans with no seam or overlap', () => {
  const dpr = 1.5
  for (let b = 100; b < 140; b++) {
    const left = devicePxSpan(b - 1, b, dpr)
    const right = devicePxSpan(b, b + 1, dpr)
    expect(left.start + left.width).toBe(right.start)
  }
})

test('clamps an oversized backing store to the safe max instead of throwing', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const canvas = {
    width: 0,
    height: 0,
    style: {} as { width?: string; height?: string },
  }
  syncCanvasSize(
    canvas as unknown as HTMLCanvasElement,
    1000,
    MAX_CANVAS_DIM_PX + 5000,
  )
  // backing store capped to the limit, but CSS size stays the requested value
  expect(canvas.height).toBe(MAX_CANVAS_DIM_PX)
  expect(canvas.width).toBe(1000)
  expect(canvas.style.height).toBe(`${MAX_CANVAS_DIM_PX + 5000}px`)
  expect(warn).toHaveBeenCalled()
  warn.mockRestore()
})

// The Canvas2D twin of the pivot inside the shaders' extendToMinWidthX. When a
// mark is widened to a floor, both must grow it away from the feature's start,
// or the fallback painter and the shader disagree by up to that floor on
// reversed blocks.
describe('spanLeft', () => {
  test('a span already wider than the floor is unaffected by the pivot', () => {
    // width === |dx|, so the result is just min(x1, x2) either way.
    expect(spanLeft(10, 20, 10)).toBe(10)
    expect(spanLeft(20, 10, 10)).toBe(10)
  })

  test('forward: the widened mark grows right off the anchored start', () => {
    expect(spanLeft(10, 10.5, 2)).toBe(10)
  })

  test('reversed: the widened mark grows left off the anchored start', () => {
    // Flipped, x1 is the feature's start *and* its right edge, so the mark hangs
    // to the left of it. Anchoring min(x1, x2) would put it at 9.5 — sliding the
    // mark toward the block's end, which is the bug this pivot exists to stop.
    expect(spanLeft(10, 9.5, 2)).toBe(8)
    expect(spanLeft(500, 499, 2)).toBe(498)
  })

  test('a zero-length span has no orientation and grows right', () => {
    // Matches the shader, where dx == 0 takes the +minWidth branch.
    expect(spanLeft(10, 10, 2)).toBe(10)
  })

  test('the anchored start edge always bounds the painted span', () => {
    for (const [x1, x2] of [
      [10, 10.5],
      [10, 9.5],
    ] as const) {
      const left = spanLeft(x1, x2, 2)
      expect([left, left + 2]).toContain(x1)
    }
  })
})

// The pivot every Canvas2D per-base cell painter needs. `makeBpMapper(bp)` is
// the cell's left edge only on a forward block; reversed, bp runs leftward so it
// lands on the cell's RIGHT edge and a rect filled rightward from it covers the
// wrong base. One base of error: invisible zoomed out, glaring zoomed in, and
// only on flipped regions.
describe('makeCellLeftMapper', () => {
  // bp 100..110 across [0,100] => 10 px/bp. bp 100 owns [0,10] forward; it's the
  // rightmost base reversed, owning [90,100].
  const span: BpRegionBounds = {
    start: 100,
    end: 110,
    screenStartPx: 0,
    screenEndPx: 100,
  }

  test('forward: identical to makeBpMapper (no shift)', () => {
    const cellLeft = makeCellLeftMapper(span)
    const bpToPx = makeBpMapper(span)
    for (const bp of [100, 105, 109]) {
      expect(cellLeft(bp)).toBeCloseTo(bpToPx(bp))
    }
  })

  test('forward: left edge of the base cell', () => {
    const cellLeft = makeCellLeftMapper(span)
    expect(cellLeft(100)).toBeCloseTo(0)
    expect(cellLeft(105)).toBeCloseTo(50)
  })

  test('reversed: left edge of that same base, one cell left of makeBpMapper', () => {
    const rev = { ...span, reversed: true }
    const cellLeft = makeCellLeftMapper(rev)
    const bpToPx = makeBpMapper(rev)
    // bp 100 spans [90,100]: makeBpMapper gives its right edge (100).
    expect(bpToPx(100)).toBeCloseTo(100)
    expect(cellLeft(100)).toBeCloseTo(90)
    expect(cellLeft(105)).toBeCloseTo(40)
  })

  test('cells tile without gap or overlap in both orientations', () => {
    for (const reversed of [false, true]) {
      const cellLeft = makeCellLeftMapper({ ...span, reversed })
      const pxPerBp = 10
      for (let bp = 100; bp < 109; bp++) {
        const here = cellLeft(bp)
        const next = cellLeft(bp + 1)
        // Neighboring cells sit exactly one cell apart, sign set by orientation.
        expect(Math.abs(next - here)).toBeCloseTo(pxPerBp)
      }
    }
  })

  test('honors screenStartPx offset and fractional zoom', () => {
    // 10bp across 5px => 0.5 px/bp, offset by 20.
    const tiny = { start: 100, end: 110, screenStartPx: 20, screenEndPx: 25 }
    expect(makeCellLeftMapper(tiny)(100)).toBeCloseTo(20)
    expect(makeCellLeftMapper({ ...tiny, reversed: true })(100)).toBeCloseTo(
      24.5,
    )
  })
})

// The inverse of makeCellLeftMapper — which base a pixel landed on — so it
// carries the same one-base pivot, and the same flipped-region trap.
describe('bpAtPx', () => {
  // bp 100..110 across [0,100] => 10 px/bp, one whole base per 10 columns
  const span: BpRegionBounds = {
    start: 100,
    end: 110,
    screenStartPx: 0,
    screenEndPx: 100,
  }

  test('every pixel of a base cell resolves back to that base, both orientations', () => {
    for (const reversed of [false, true]) {
      const bounds = { ...span, reversed }
      const cellLeft = makeCellLeftMapper(bounds)
      for (let bp = 100; bp < 110; bp++) {
        const left = cellLeft(bp)
        expect(bpAtPx(left, bounds)).toBe(bp)
        expect(bpAtPx(left + 5, bounds)).toBe(bp)
        expect(bpAtPx(left + 9.99, bounds)).toBe(bp)
      }
    }
  })

  test('the first pixel column names the base painted there', () => {
    // reversed, flooring the raw inverse gave 110 here — outside the block
    expect(bpAtPx(0, { ...span, reversed: true })).toBe(109)
    expect(bpAtPx(0, span)).toBe(100)
  })

  test('never leaves the block over its full width', () => {
    for (const reversed of [false, true]) {
      for (let px = 0; px < 100; px += 0.5) {
        const bp = bpAtPx(px, { ...span, reversed })
        expect(bp).toBeGreaterThanOrEqual(100)
        expect(bp).toBeLessThan(110)
      }
    }
  })

  test('honors screenStartPx offset', () => {
    const offset = { ...span, screenStartPx: 20, screenEndPx: 120 }
    expect(bpAtPx(20, offset)).toBe(100)
    expect(bpAtPx(20, { ...offset, reversed: true })).toBe(109)
  })

  // A pixel that lands EXACTLY on a base boundary must name the base starting
  // there. These are not contrived floats — each px below divides the block at
  // a whole base: 560 * 90 / 800 = 63, and 1408 * 75 / 1920 = 55, both exact in
  // real arithmetic.
  //
  // They are also what the previous spelling got wrong. It formed
  // `frac = px / width` and floored `frac * span`, which rounds twice: 560/800
  // is 0.7, not representable, and 0.7 * 90 comes out 62.99999999999999, so the
  // cursor sitting on base 63's first column reported base 62 — and 27 instead
  // of 26 with the region flipped. `bpAtPx` multiplies before dividing, so the
  // one division is the only rounding and an exact quotient stays exact.
  //
  // Measured against an exact rational oracle over 11.6M realistic samples
  // (integer through eighth-pixel cursor positions, chr1-scale starts, 1bp to
  // 3Mb spans, both orientations, fractional block offsets), the fused form is
  // exact on all of them and the `frac` form named the wrong base 4202 times.
  test.each([
    // [spanBp, width, px, forward base, reversed base]
    [90, 800, 560, 63, 26],
    [75, 1920, 1408, 55, 19],
  ])(
    'a pixel on an exact base boundary names that base (%ibp over %ipx)',
    (spanBp, width, px, forwardBp, reversedBp) => {
      const bounds: BpRegionBounds = {
        start: 0,
        end: spanBp,
        screenStartPx: 0,
        screenEndPx: width,
      }
      expect(bpAtPx(px, bounds)).toBe(forwardBp)
      expect(bpAtPx(px, { ...bounds, reversed: true })).toBe(reversedBp)
    },
  )

  // The same property as a sweep, so a future rewrite has to hold it everywhere
  // rather than at the two points above. Integer-only oracle: `i` and `spanBp`
  // are integers so the numerator is exact and the division is one rounded step.
  //
  // **`start: 0` is load-bearing here.** A chr1-scale start hides the very error
  // this is for: the old spelling ended in `Math.floor(start + frac * span)`,
  // and adding a genome-scale addend coarsens the sum's ULP far past the drift
  // in `frac * span`, so the wrong value often rounds back to the right one. The
  // large-start row is kept as well, since that masking is luck rather than a
  // guarantee.
  test.each([0, 155_000_000])(
    'agrees with exact integer arithmetic across whole blocks (start %i)',
    start => {
      for (const [spanBp, width] of [
        [90, 800],
        [75, 1920],
        [37, 997],
        [799, 1233],
      ] as const) {
        for (const reversed of [false, true]) {
          const bounds: BpRegionBounds = {
            start,
            end: start + spanBp,
            screenStartPx: 0,
            screenEndPx: width,
            reversed,
          }
          for (let i = 0; i < width * 2; i++) {
            const idx = Math.floor((i * spanBp) / (width * 2))
            const expected = reversed
              ? bounds.end - 1 - idx
              : bounds.start + idx
            expect(bpAtPx(i / 2, bounds)).toBe(expected)
          }
        }
      }
    },
  )
})

test('syncCanvasSize keeps CSS size in step once the backing store clamps', () => {
  const canvas = document.createElement('canvas')
  const overCss = (MAX_CANVAS_DIM_PX + 1000) / getDpr()
  const evenMoreCss = (MAX_CANVAS_DIM_PX + 2000) / getDpr()

  syncCanvasSize(canvas, overCss, 100)
  expect(canvas.width).toBe(MAX_CANVAS_DIM_PX)
  expect(canvas.style.width).toBe(`${overCss}px`)

  // The backing store is pinned at the clamp, so it reports no change — but the
  // element still has to lay out at the new CSS width.
  syncCanvasSize(canvas, evenMoreCss, 100)
  expect(canvas.width).toBe(MAX_CANVAS_DIM_PX)
  expect(canvas.style.width).toBe(`${evenMoreCss}px`)
})

describe('getDpr', () => {
  const original = globalThis.devicePixelRatio

  function setDpr(value: number) {
    Object.defineProperty(globalThis, 'devicePixelRatio', {
      value,
      writable: true,
      configurable: true,
    })
  }

  afterEach(() => {
    setDpr(original)
  })

  test('passes through ratios up to the cap', () => {
    setDpr(1)
    expect(getDpr()).toBe(1)
    setDpr(1.5)
    expect(getDpr()).toBe(1.5)
    setDpr(MAX_DPR)
    expect(getDpr()).toBe(MAX_DPR)
  })

  // Cost scales with dpr², and nobody resolves past 2x. Capping inside getDpr
  // rather than at each call site is what keeps the backing store, the scissor
  // rects derived from it, and the variant-matrix shader uniform on one ratio.
  test('caps ratios above MAX_DPR', () => {
    setDpr(3)
    expect(getDpr()).toBe(MAX_DPR)
    setDpr(4)
    expect(getDpr()).toBe(MAX_DPR)
  })
})

describe('withClip', () => {
  function makeRecordingCtx() {
    const log: string[] = []
    const rects: number[][] = []
    return {
      log,
      rects,
      ctx: {
        save: () => log.push('save'),
        restore: () => log.push('restore'),
        beginPath: () => log.push('beginPath'),
        clip: () => log.push('clip'),
        rect: (x: number, y: number, w: number, h: number) => {
          log.push('rect')
          rects.push([x, y, w, h])
        },
      },
    }
  }

  test('clips to the given rect around the paint', () => {
    const { ctx, log, rects } = makeRecordingCtx()
    withClip(ctx, 5, 10, 20, 30, () => {
      log.push('paint')
    })
    expect(log).toEqual([
      'save',
      'beginPath',
      'rect',
      'clip',
      'paint',
      'restore',
    ])
    expect(rects[0]).toEqual([5, 10, 20, 30])
  })

  test('restores when paint throws', () => {
    const { ctx, log } = makeRecordingCtx()
    expect(() => {
      withClip(ctx, 0, 0, 1, 1, () => {
        throw new Error('boom')
      })
    }).toThrow('boom')
    expect(log.at(-1)).toBe('restore')
  })

  // The nesting case is the one a hand-rolled pairing gets wrong: a display
  // whose bands each clip inside a block clip. An inner throw has to unwind
  // both, or the block's clip outlives the frame too.
  test('unwinds every level when an inner paint throws', () => {
    const { ctx, log } = makeRecordingCtx()
    expect(() => {
      withClip(ctx, 0, 0, 100, 100, () => {
        withClip(ctx, 0, 0, 100, 10, () => {
          throw new Error('boom')
        })
      })
    }).toThrow('boom')
    expect(log.filter(c => c === 'save')).toHaveLength(2)
    expect(log.filter(c => c === 'restore')).toHaveLength(2)
  })
})

describe('forEachClippedBlock', () => {
  function makeRecordingCtx() {
    const log: string[] = []
    const rects: number[][] = []
    return {
      log,
      rects,
      ctx: {
        save: () => log.push('save'),
        restore: () => log.push('restore'),
        beginPath: () => log.push('beginPath'),
        clip: () => log.push('clip'),
        rect: (x: number, y: number, w: number, h: number) => {
          log.push('rect')
          rects.push([x, y, w, h])
        },
      },
    }
  }

  const block = (displayedRegionIndex: number, screenStartPx: number) => ({
    displayedRegionIndex,
    start: 0,
    end: 100,
    screenStartPx,
    screenEndPx: screenStartPx + 100,
    reversed: false,
  })

  test('clips to the block span and the caller-supplied height', () => {
    const { ctx, log, rects } = makeRecordingCtx()
    forEachClippedBlock(
      ctx,
      [block(0, 10)],
      1000,
      42,
      () => 'data',
      () => {
        log.push('paint')
      },
    )
    expect(log).toEqual([
      'save',
      'beginPath',
      'rect',
      'clip',
      'paint',
      'restore',
    ])
    expect(rects[0]).toEqual([10, 0, 100, 42])
  })

  test('skips the block entirely when select returns undefined', () => {
    const { ctx, log } = makeRecordingCtx()
    forEachClippedBlock(
      ctx,
      [block(0, 10)],
      1000,
      50,
      () => undefined,
      () => {
        log.push('paint')
      },
    )
    // Not merely "paint never ran" — nothing may reach the context at all, so
    // an empty block costs neither a real context's clip round trip nor a
    // queued group on SvgCanvas.
    expect(log).toEqual([])
  })

  test('skips an off-screen block without opening a clip', () => {
    const { ctx, log } = makeRecordingCtx()
    forEachClippedBlock(
      ctx,
      [block(0, -500)],
      100,
      50,
      () => 'data',
      () => {
        log.push('paint')
      },
    )
    expect(log).toEqual([])
  })

  test('pairs save/restore per painted block and passes each block through', () => {
    const { ctx, log } = makeRecordingCtx()
    const seen: number[] = []
    forEachClippedBlock(
      ctx,
      [block(0, 0), block(1, 100), block(2, 200)],
      1000,
      50,
      b => (b.displayedRegionIndex === 1 ? undefined : b.displayedRegionIndex),
      idx => {
        seen.push(idx)
      },
    )
    expect(seen).toEqual([0, 2])
    expect(log.filter(c => c === 'save')).toHaveLength(2)
    expect(log.filter(c => c === 'restore')).toHaveLength(2)
  })

  test('restores even when paint throws, so the clip cannot leak', () => {
    const { ctx, log } = makeRecordingCtx()
    expect(() => {
      forEachClippedBlock(
        ctx,
        [block(0, 0)],
        1000,
        50,
        () => 'data',
        () => {
          throw new Error('boom')
        },
      )
    }).toThrow('boom')
    expect(log).toContain('restore')
  })
})
