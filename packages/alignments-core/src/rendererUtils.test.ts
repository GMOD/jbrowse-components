import { coverageLayout, interbaseBarHeightPx } from './coverageBandBox.ts'
import { INDICATOR_TRIANGLE_HW } from './labelConstants.ts'
import {
  CANVAS2D_COVERAGE,
  drawCoverageBins,
  drawIndicators,
  drawInterbaseSegments,
  drawModCovSegments,
  drawSnpSegments,
  emptyCanvas2DCoverageBuffer,
  packCoverageBinsCanvas2D,
  snpColorForType,
} from './rendererUtils.ts'

function makeCtx() {
  const calls: { method: string; args: unknown[] }[] = []
  let currentFill = ''
  const ctx = {
    get fillStyle() {
      return currentFill
    },
    set fillStyle(v: string) {
      currentFill = v
      calls.push({ method: 'fillStyle', args: [v] })
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ method: 'fillRect', args: [x, y, w, h] })
    },
    beginPath() {},
    moveTo(x: number, y: number) {
      calls.push({ method: 'moveTo', args: [x, y] })
    },
    lineTo() {},
    closePath() {},
    fill() {},
  }
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D }
}

describe('coverageLayout', () => {
  it('computes effective height and bottom', () => {
    const layout = coverageLayout(50)
    expect(layout.effectiveH).toBe(40) // 50 - 2*5
    expect(layout.bottom).toBe(45) // 50 - 5
  })
})

describe('snpColorForType', () => {
  const colors = {
    baseA: 'red',
    baseC: 'blue',
    baseG: 'green',
    baseT: 'yellow',
    baseN: 'grey',
    mismatch: 'gray',
    deletion: 'black',
    insertion: 'purple',
  }

  it('returns correct base colors', () => {
    expect(snpColorForType(1, colors)).toBe('red')
    expect(snpColorForType(2, colors)).toBe('blue')
    expect(snpColorForType(3, colors)).toBe('green')
    expect(snpColorForType(4, colors)).toBe('yellow')
  })

  it('returns baseN (grey) for N and unknown types', () => {
    expect(snpColorForType(5, colors)).toBe('grey')
    expect(snpColorForType(0, colors)).toBe('grey')
  })
})

describe('packCoverageBinsCanvas2D', () => {
  // Guards the pack/read contract that broke MAF's grey histogram: the buffer
  // must be the 3-float CANVAS2D_COVERAGE layout (raw depth in `bandTop`), the
  // format `drawCoverageBins` reads — NOT the 2-float GPU `relDepth` layout.
  it('packs raw depths in the CANVAS2D_COVERAGE layout', () => {
    const buf = packCoverageBinsCanvas2D(new Float32Array([7, 0, 3]), 100)
    const { STRIDE_F32, FIELD } = CANVAS2D_COVERAGE
    expect(buf.byteLength).toBe(3 * STRIDE_F32 * 4)

    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < 3; i++) {
      const off = i * STRIDE_F32
      expect(u32[off + FIELD.position]).toBe(100 + i)
      expect(f32[off + FIELD.bandBottom]).toBe(0)
    }
    // eslint-disable-next-line unicorn/no-constant-zero-expression -- row 0, kept parallel to row 2 below
    expect(f32[0 * STRIDE_F32 + FIELD.bandTop]).toBe(7)
    expect(f32[2 * STRIDE_F32 + FIELD.bandTop]).toBe(3)
  })
})

describe('drawCoverageBins', () => {
  const identity = (d: number) => d

  it('draws a packed bin to the right height + width', () => {
    // depth 0.8: coverageHeight 50 → effectiveH 40, bottom 45, so the bar spans
    // y=[45-0.8*40, 45] = [13, 45], height 32. Round-trips pack → draw.
    const buf = packCoverageBinsCanvas2D(new Float32Array([0.8, 0.5]), 100)
    const { ctx, calls } = makeCtx()
    const bpToX = (bp: number) => (bp - 100) * 10

    drawCoverageBins(ctx, buf, identity, 50, 'blue', bpToX, 200)

    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(2)
    const [x, y, w, h] = fillCalls[0]!.args as number[]
    expect(x).toBe(0)
    expect(w).toBe(10)
    expect(y).toBeCloseTo(13)
    expect(h).toBeCloseTo(32)
  })

  it('applies width compensation so adjacent bars overlap', () => {
    const buf = packCoverageBinsCanvas2D(new Float32Array([0.5]), 100)
    const { ctx, calls } = makeCtx()
    const bpToX = (bp: number) => (bp - 100) * 10

    drawCoverageBins(ctx, buf, identity, 50, 'blue', bpToX, 200, 0.8)

    const fillCall = calls.find(c => c.method === 'fillRect')
    expect(fillCall!.args[2]).toBe(10.8)
  })

  it('skips bins outside viewport', () => {
    const buf = packCoverageBinsCanvas2D(new Float32Array([0.5]), 1000)
    const { ctx, calls } = makeCtx()
    const bpToX = (bp: number) => (bp - 1000) * 10 + 500

    drawCoverageBins(ctx, buf, identity, 50, 'blue', bpToX, 200)

    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(0)
  })

  it('does nothing with zero bins', () => {
    const { ctx, calls } = makeCtx()
    drawCoverageBins(
      ctx,
      emptyCanvas2DCoverageBuffer(),
      identity,
      50,
      'blue',
      () => 0,
      200,
    )
    expect(calls.length).toBe(0)
  })

  // The seam fudge is a width, not a vote on whether the bar is sub-pixel.
  // `expandMinWidthX` centers at a TRUE span under 1 CSS px; passing the fudged
  // width to `minWidthLeft` moved that switch to a span under 0.2px, so every
  // bar between 1 and 5 bp/px stayed left-anchored while the GPU centered it —
  // and while the SNP segment stacked ON that bar (no fudge, so already
  // centered) went the other way. Same bar, same bp, two pivots.
  it('centers a sub-pixel bar on its span, fudge or no fudge', () => {
    // 0.5 px per bp: the bar is sub-pixel, but 0.5 + 0.8 is not.
    const bpToX = (bp: number) => (bp - 100) * 0.5
    const left = (compensation: number) => {
      const { ctx, calls } = makeCtx()
      drawCoverageBins(
        ctx,
        packCoverageBinsCanvas2D(new Float32Array([0.5]), 100),
        identity,
        50,
        'blue',
        bpToX,
        200,
        compensation,
      )
      return (calls.find(c => c.method === 'fillRect')!.args as number[])[0]!
    }
    // midpoint 0.25, minus half of the 1px minimum
    expect(left(0)).toBeCloseTo(-0.25)
    expect(left(0.8)).toBeCloseTo(-0.25)
  })

  it('a sub-pixel bar and the SNP segment inside it share a left edge', () => {
    const bpToX = (bp: number) => (bp - 100) * 0.5
    const bar = makeCtx()
    drawCoverageBins(
      bar.ctx,
      packCoverageBinsCanvas2D(new Float32Array([1]), 100),
      identity,
      50,
      'blue',
      bpToX,
      200,
      0.8,
    )
    const snp = makeCtx()
    const snpBuf = new ArrayBuffer(20)
    new Uint32Array(snpBuf)[0] = 100
    new Float32Array(snpBuf).set([0, 0.5, 1, 1], 1)
    drawSnpSegments(
      snp.ctx,
      snpBuf,
      identity,
      1,
      50,
      {
        baseA: 'red',
        baseC: '',
        baseG: '',
        baseT: '',
        baseN: '',
      },
      bpToX,
      200,
    )
    const x = (c: ReturnType<typeof makeCtx>) =>
      (c.calls.find(f => f.method === 'fillRect')!.args as number[])[0]!
    expect(x(bar)).toBeCloseTo(x(snp))
  })
})

describe('drawSnpSegments', () => {
  // coverageHeight=50, YSCALEBAR_LABEL_OFFSET=5 → effectiveH=40, bottom=45
  const coverageHeight = 50
  const effectiveH = 40
  const bottom = 45

  const colors = {
    baseA: 'red',
    baseC: 'blue',
    baseG: 'green',
    baseT: 'yellow',
    baseN: 'grey',
    mismatch: '',
    deletion: '',
    insertion: '',
  }

  // 5-float SNP record matching coverageSnp.slang layout.
  function makeSnpBuf(
    pos: number,
    yOffset: number,
    segHeight: number,
    colorType: number,
    relDepth: number,
  ) {
    const buf = new ArrayBuffer(20)
    const f32 = new Float32Array(buf)
    const u32 = new Uint32Array(buf)
    u32[0] = pos
    f32[1] = yOffset
    f32[2] = segHeight
    f32[3] = colorType
    f32[4] = relDepth
    return buf
  }

  it('draws segments with correct colors', () => {
    const buf = makeSnpBuf(100, 0.5, 0.3, 1, 1)
    const { ctx, calls } = makeCtx()
    drawSnpSegments(
      ctx,
      buf,
      d => d,
      1,
      coverageHeight,
      colors,
      bp => bp - 100,
      200,
    )
    const styleCalls = calls.filter(c => c.method === 'fillStyle')
    expect(styleCalls.some(c => c.args[0] === 'red')).toBe(true)
  })

  it('linear scale: positions SNP as fraction of per-position bar', () => {
    // totalDepth=domainMax=100, so bar fills the whole effectiveH.
    // yOffset=0, segHeight=0.3 (30% of this position's bar) → 30% of effectiveH.
    const buf = makeSnpBuf(100, 0, 0.3, 1, 1)
    const { ctx, calls } = makeCtx()
    drawSnpSegments(
      ctx,
      buf,
      (d: number) => d / 100,
      100,
      coverageHeight,
      colors,
      bp => bp - 100,
      200,
    )
    const rects = calls.filter(c => c.method === 'fillRect')
    expect(rects).toHaveLength(1)
    const [, y, , h] = rects[0]!.args as number[]
    expect(y).toBeCloseTo(bottom - 0.3 * effectiveH, 5)
    expect(h).toBeCloseTo(0.3 * effectiveH, 5)
  })

  it('log scale: SNP is a linear fraction of the log-scaled bar', () => {
    // totalDepth=100, domainMax=1000. relDepth=0.1 (=100/1000).
    // log-normalized bar height = log2(100)/log2(1000) * effectiveH.
    const domainMax = 1000
    const totalDepth = 100
    const logBarFrac = Math.log2(totalDepth) / Math.log2(domainMax)
    const expectedBarH = logBarFrac * effectiveH

    // yOffset=0, segHeight=0.1 (10 SNPs / 100 totalDepth at position).
    const buf = makeSnpBuf(100, 0, 0.1, 1, totalDepth / domainMax)
    const logNormalize = (d: number) =>
      Math.log2(Math.max(d, 1)) / Math.log2(Math.max(domainMax, 1))
    const { ctx, calls } = makeCtx()
    drawSnpSegments(
      ctx,
      buf,
      logNormalize,
      domainMax,
      coverageHeight,
      colors,
      bp => bp - 100,
      200,
    )
    const rects = calls.filter(c => c.method === 'fillRect')
    expect(rects).toHaveLength(1)
    const [, , , h] = rects[0]!.args as number[]
    expect(h).toBeCloseTo(0.1 * expectedBarH, 5)
  })

  it('log scale bar is taller than linear for same depth', () => {
    const domainMax = 1000
    const totalDepth = 100
    const buf = makeSnpBuf(100, 0, 0.1, 1, totalDepth / domainMax)

    const { ctx: linCtx, calls: linCalls } = makeCtx()
    drawSnpSegments(
      linCtx,
      buf,
      (d: number) => d / domainMax,
      domainMax,
      coverageHeight,
      colors,
      bp => bp - 100,
      200,
    )

    const logNorm = (d: number) =>
      Math.log2(Math.max(d, 1)) / Math.log2(Math.max(domainMax, 1))
    const { ctx: logCtx, calls: logCalls } = makeCtx()
    drawSnpSegments(
      logCtx,
      buf,
      logNorm,
      domainMax,
      coverageHeight,
      colors,
      bp => bp - 100,
      200,
    )

    const linH = (
      linCalls.find(c => c.method === 'fillRect')!.args as number[]
    )[3]!
    const logH = (
      logCalls.find(c => c.method === 'fillRect')!.args as number[]
    )[3]!
    expect(logH).toBeGreaterThan(linH)
  })
})

describe('drawModCovSegments', () => {
  // coverageHeight=50, YSCALEBAR_LABEL_OFFSET=5 → effectiveH=40, bottom=45
  const coverageHeight = 50
  const effectiveH = 40
  const bottom = 45

  // 5-float modCov record matching coverageMod.slang layout.
  function makeModCovBuf(
    pos: number,
    yOffset: number,
    segH: number,
    r: number,
    g: number,
    b: number,
    a: number,
    relDepth: number,
  ) {
    const buf = new ArrayBuffer(20)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    u32[0] = pos
    f32[1] = yOffset
    f32[2] = segH
    // packed ABGR: r in bits 0-7, g in 8-15, b in 16-23, a in 24-31
    u32[3] =
      (r & 0xff) | ((g & 0xff) << 8) | ((b & 0xff) << 16) | ((a & 0xff) << 24)
    f32[4] = relDepth
    return buf
  }

  it('draws with 1bp width at high zoom', () => {
    const buf = makeModCovBuf(100, 0.5, 0.3, 255, 0, 0, 255, 1)
    const { ctx, calls } = makeCtx()
    drawModCovSegments(
      ctx,
      buf,
      d => d,
      1,
      50,
      bp => (bp - 100) * 10,
      200,
    )
    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(1)
    const [, , w] = fillCalls[0]!.args as [number, number, number, number]
    expect(w).toBe(10)
  })

  it('clamps width to 1px at low zoom', () => {
    const buf = makeModCovBuf(100, 0.5, 0.3, 255, 0, 0, 255, 1)
    const { ctx, calls } = makeCtx()
    drawModCovSegments(
      ctx,
      buf,
      d => d,
      1,
      50,
      bp => (bp - 100) * 0.1,
      200,
    )
    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(1)
    const [, , w] = fillCalls[0]!.args as [number, number, number, number]
    expect(w).toBe(1)
  })

  it('unpacks color correctly', () => {
    const buf = makeModCovBuf(100, 0.5, 0.3, 200, 100, 50, 255, 1)
    const { ctx, calls } = makeCtx()
    drawModCovSegments(
      ctx,
      buf,
      d => d,
      1,
      50,
      bp => (bp - 100) * 5,
      200,
    )
    const styleCall = calls.find(c => c.method === 'fillStyle')
    expect(styleCall?.args[0]).toBe('rgba(200,100,50,1)')
  })

  it('linear scale: positions mod segment as fraction of per-position bar', () => {
    const buf = makeModCovBuf(100, 0, 0.3, 200, 100, 50, 255, 1)
    const { ctx, calls } = makeCtx()
    drawModCovSegments(
      ctx,
      buf,
      (d: number) => d / 100,
      100,
      coverageHeight,
      bp => bp - 100,
      200,
    )
    const rects = calls.filter(c => c.method === 'fillRect')
    expect(rects).toHaveLength(1)
    const [, y, , h] = rects[0]!.args as number[]
    expect(y).toBeCloseTo(bottom - 0.3 * effectiveH, 5)
    expect(h).toBeCloseTo(0.3 * effectiveH, 5)
  })

  it('log scale: mod segment is a linear fraction of the log-scaled bar', () => {
    const domainMax = 1000
    const totalDepth = 100
    const logBarFrac = Math.log2(totalDepth) / Math.log2(domainMax)
    const expectedBarH = logBarFrac * effectiveH

    const buf = makeModCovBuf(
      100,
      0,
      0.1,
      200,
      100,
      50,
      255,
      totalDepth / domainMax,
    )
    const logNormalize = (d: number) =>
      Math.log2(Math.max(d, 1)) / Math.log2(Math.max(domainMax, 1))
    const { ctx, calls } = makeCtx()
    drawModCovSegments(
      ctx,
      buf,
      logNormalize,
      domainMax,
      coverageHeight,
      bp => bp - 100,
      200,
    )
    const rects = calls.filter(c => c.method === 'fillRect')
    expect(rects).toHaveLength(1)
    const [, , , h] = rects[0]!.args as number[]
    expect(h).toBeCloseTo(0.1 * expectedBarH, 5)
  })

  it('log scale bar is taller than linear for same depth', () => {
    const domainMax = 1000
    const totalDepth = 100
    const buf = makeModCovBuf(
      100,
      0,
      0.1,
      200,
      100,
      50,
      255,
      totalDepth / domainMax,
    )

    const { ctx: linCtx, calls: linCalls } = makeCtx()
    drawModCovSegments(
      linCtx,
      buf,
      (d: number) => d / domainMax,
      domainMax,
      coverageHeight,
      bp => bp - 100,
      200,
    )

    const logNorm = (d: number) =>
      Math.log2(Math.max(d, 1)) / Math.log2(Math.max(domainMax, 1))
    const { ctx: logCtx, calls: logCalls } = makeCtx()
    drawModCovSegments(
      logCtx,
      buf,
      logNorm,
      domainMax,
      coverageHeight,
      bp => bp - 100,
      200,
    )

    const linH = (
      linCalls.find(c => c.method === 'fillRect')!.args as number[]
    )[3]!
    const logH = (
      logCalls.find(c => c.method === 'fillRect')!.args as number[]
    )[3]!
    expect(logH).toBeGreaterThan(linH)
  })
})

describe('drawIndicators', () => {
  const interbaseColors = {
    insertion: 'purple',
    softclip: 'cyan',
    hardclip: 'orange',
  }

  it('draws triangles at positions with correct colors', () => {
    const buf = new ArrayBuffer(16)
    const f32 = new Float32Array(buf)
    const u32 = new Uint32Array(buf)
    u32[0] = 50
    f32[1] = 1 // insertion
    u32[2] = 150
    f32[3] = 2 // softclip

    const { ctx, calls } = makeCtx()
    drawIndicators(ctx, buf, interbaseColors, (bp: number) => bp, 200)

    const styleCalls = calls.filter(c => c.method === 'fillStyle')
    expect(styleCalls.some(c => c.args[0] === 'purple')).toBe(true)
    expect(styleCalls.some(c => c.args[0] === 'cyan')).toBe(true)
  })

  // The position is a uint32 in the position slot — writing it through the f32
  // view stored the BIT PATTERN of 300.0 (1133248512), which this culled for
  // being a billion px off screen rather than for being at 300.
  it('skips indicators outside viewport', () => {
    const buf = new ArrayBuffer(8)
    const f32 = new Float32Array(buf)
    const u32 = new Uint32Array(buf)
    u32[0] = 300
    f32[1] = 1

    const { ctx, calls } = makeCtx()
    drawIndicators(ctx, buf, interbaseColors, (bp: number) => bp, 200)

    expect(calls.filter(c => c.method === 'moveTo')).toHaveLength(0)
  })

  // The mark is a 7px-wide triangle CENTERED on its bp, so one whose center sits
  // just past an edge still shows several pixels inside it. coverageIndicator.slang does
  // no x-cull at all — it emits the triangle and lets the scissor clip it — so
  // culling on the center alone dropped, in Canvas2D and therefore in the SVG
  // export, a sliver the GPU draws. Every block boundary in a multi-region view
  // is such an edge, not just the two ends of the canvas.
  it.each([
    ['just inside the left edge', -INDICATOR_TRIANGLE_HW + 1],
    ['just inside the right edge', 200 + INDICATOR_TRIANGLE_HW - 1],
  ])('draws a triangle overlapping the viewport: %s', (_name, pos) => {
    const buf = new ArrayBuffer(8)
    const f32 = new Float32Array(buf)
    f32[1] = 1
    const { ctx, calls } = makeCtx()
    drawIndicators(ctx, buf, interbaseColors, () => pos, 200)

    expect(calls.filter(c => c.method === 'moveTo')).toHaveLength(1)
  })

  it.each([
    ['fully past the left edge', -INDICATOR_TRIANGLE_HW - 1],
    ['fully past the right edge', 200 + INDICATOR_TRIANGLE_HW + 1],
  ])('still culls one that cannot show: %s', (_name, pos) => {
    const buf = new ArrayBuffer(8)
    const f32 = new Float32Array(buf)
    f32[1] = 1
    const { ctx, calls } = makeCtx()
    drawIndicators(ctx, buf, interbaseColors, () => pos, 200)

    expect(calls.filter(c => c.method === 'moveTo')).toHaveLength(0)
  })
})

describe('drawInterbaseSegments', () => {
  const interbaseColors = {
    insertion: 'purple',
    softclip: 'cyan',
    hardclip: 'orange',
  }
  // coverageHeight 90 → effectiveH 80 → half-band 40; maxCount/domainMax = 1.
  const COV_HEIGHT = 90
  const MAX_COUNT = 20
  const DOMAIN_MAX = 20
  const VIEW = 200

  // One full-height insertion segment at bp 100.
  function oneSegment() {
    const buf = new ArrayBuffer(16)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    u32[0] = 100
    f32[1] = 0 // yOffset
    f32[2] = 1 // segHeight
    f32[3] = 1 // colorType: insertion
    return buf
  }

  function draw(bpToX: (bp: number) => number, domainMax = DOMAIN_MAX) {
    const { ctx, calls } = makeCtx()
    drawInterbaseSegments(
      ctx,
      oneSegment(),
      MAX_COUNT,
      interbaseColors,
      bpToX,
      VIEW,
      COV_HEIGHT,
      domainMax,
    )
    return calls.filter(c => c.method === 'fillRect')
  }

  it('draws a 1px bar centered on the bp boundary', () => {
    // Both edges snap to whole px: top floor(4.5 + 0.5) = 5, bottom
    // floor(4.5 + 40 + 0.5) = 45.
    expect(draw(bp => bp - 50)[0]!.args).toEqual([49.5, 5, 1, 40])
  })

  // The mark is 1px wide and CENTERED on `bpToX(pos)`, so half of it still shows
  // when the boundary itself is half a pixel outside. coverageInterbase.slang
  // emits the quad and lets the scissor clip it, so culling the bp CELL
  // (bpToX(pos)..bpToX(pos + 1)) dropped a sliver the GPU draws — at every block
  // boundary of a multi-region view, not just the two ends of the canvas.
  it.each([
    ['overlapping the left edge', -0.4],
    ['overlapping the right edge', VIEW + 0.4],
  ])('draws a bar %s', (_name, px) => {
    expect(draw(() => px)).toHaveLength(1)
  })

  it.each([
    ['fully past the left edge', -0.6],
    ['fully past the right edge', VIEW + 0.6],
  ])('still culls a bar %s', (_name, px) => {
    expect(draw(() => px)).toHaveLength(0)
  })

  it('draws nothing before the coverage domain resolves', () => {
    expect(draw(bp => bp - 50, 0)).toHaveLength(0)
  })
})

describe('interbaseBarHeightPx', () => {
  // The height the GPU uniform, the Canvas2D draw and the hit test all read.
  it('is half the coverage drawing height at the region peak', () => {
    // coverageHeight 90 → effectiveH 80; peak depth == domain → half-band.
    expect(interbaseBarHeightPx(90, 20, 20)).toBe(40)
  })

  it('shortens when the domain is rounded up past the region peak', () => {
    expect(interbaseBarHeightPx(90, 20, 40)).toBe(20)
  })

  it.each([
    ['no interbase events', 0, 20],
    ['the domain has not resolved', 20, undefined],
    ['an empty domain', 20, 0],
  ])('is 0 when %s', (_name, maxCount, domainMax) => {
    expect(interbaseBarHeightPx(90, maxCount, domainMax)).toBe(0)
  })
})

// Every bar layer here resolves a bp cell to `bpToX(pos)` + a width. On a
// reversed block bpToX runs bp leftward, so bpToX(pos) is the cell's RIGHT edge
// and `px2 - px` is NEGATIVE — which `Math.max(..., 1)` silently clamped to a
// 1px sliver anchored one cell off. The coverage histogram all but vanished on
// a flipped region once zoomed past 1bp/px. These pin the mirror instead.
describe('reversed blocks', () => {
  const identity = (d: number) => d
  const VIEW = 200
  // bp 100..120 across 200px = 10 px/bp. Forward: bp 100 → [0,10].
  // Reversed: bp 100 is the rightmost base → [190,200].
  const fwd = (bp: number) => (bp - 100) * 10
  const rev = (bp: number) => VIEW - (bp - 100) * 10

  function widthAndX(bpToX: (bp: number) => number) {
    const { ctx, calls } = makeCtx()
    drawCoverageBins(
      ctx,
      packCoverageBinsCanvas2D(new Float32Array([0.5]), 100),
      identity,
      50,
      'blue',
      bpToX,
      VIEW,
    )
    const [x, , w] = calls.find(c => c.method === 'fillRect')!.args as number[]
    return { x: x!, w: w! }
  }

  it('drawCoverageBins spans a full bin, not a 1px sliver', () => {
    expect(widthAndX(fwd)).toEqual({ x: 0, w: 10 })
    // The bar must cover bp 100's cell — [190,200] — not sit at 200 with w=1.
    expect(widthAndX(rev)).toEqual({ x: 190, w: 10 })
  })

  it('drawSnpSegments spans a full base', () => {
    const buf = new ArrayBuffer(5 * 4)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    u32[0] = 100
    f32[1] = 0
    f32[2] = 1
    f32[3] = 1
    f32[4] = 1
    const colors = {
      baseA: 'red',
      baseC: 'blue',
      baseG: 'green',
      baseT: 'yellow',
      baseN: 'grey',
      mismatch: 'gray',
      deletion: 'black',
      insertion: 'purple',
    }
    const draw = (bpToX: (bp: number) => number) => {
      const { ctx, calls } = makeCtx()
      drawSnpSegments(ctx, buf, identity, 1, 50, colors, bpToX, VIEW)
      const [x, , w] = calls.find(c => c.method === 'fillRect')!
        .args as number[]
      return { x: x!, w: w! }
    }
    expect(draw(fwd)).toEqual({ x: 0, w: 10 })
    expect(draw(rev)).toEqual({ x: 190, w: 10 })
  })

  it('a bin straddling the left viewport edge is not culled when reversed', () => {
    // bp 119 sits at reversed screen [0,10] — fully visible. The old cull
    // (`px2 < 0`, assuming px < px2) compared the wrong edge and dropped it.
    const { ctx, calls } = makeCtx()
    drawCoverageBins(
      ctx,
      packCoverageBinsCanvas2D(new Float32Array([0.5]), 119),
      identity,
      50,
      'blue',
      rev,
      VIEW,
    )
    expect(calls.filter(c => c.method === 'fillRect').length).toBe(1)
  })
})
