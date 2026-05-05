import {
  coverageLayout,
  drawCoverageBins,
  drawIndicators,
  drawModCovSegments,
  drawSnpSegments,
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
    moveTo() {},
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
    mismatch: 'gray',
    deletion: 'black',
    insertion: 'purple',
  }

  it('returns correct base colors', () => {
    expect(snpColorForType(1, colors)).toBe('red')
    expect(snpColorForType(2, colors)).toBe('blue')
    expect(snpColorForType(3, colors)).toBe('green')
  })

  it('defaults to baseT for unknown types', () => {
    expect(snpColorForType(4, colors)).toBe('yellow')
    expect(snpColorForType(0, colors)).toBe('yellow')
  })
})

describe('drawCoverageBins', () => {
  const identity = (d: number) => d

  it('draws bins as rectangles', () => {
    const buf = new ArrayBuffer(2 * 12)
    const f32 = new Float32Array(buf)
    const u32 = new Uint32Array(buf)
    // bin 0: pos=100, yOffset=0.2, depth=0.8
    u32[0] = 100
    f32[1] = 0.2
    f32[2] = 0.8
    // bin 1: pos=101, yOffset=0.1, depth=0.5
    u32[3] = 101
    f32[4] = 0.1
    f32[5] = 0.5

    const { ctx, calls } = makeCtx()
    const bpToX = (bp: number) => (bp - 100) * 10

    drawCoverageBins(ctx, buf, 2, identity, 50, 'blue', bpToX, 200)

    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(2)
  })

  it('skips bins outside viewport', () => {
    const buf = new ArrayBuffer(12)
    const f32 = new Float32Array(buf)
    const u32 = new Uint32Array(buf)
    u32[0] = 1000
    f32[1] = 0.5
    f32[2] = 0.5

    const { ctx, calls } = makeCtx()
    const bpToX = (bp: number) => (bp - 1000) * 10 + 500

    drawCoverageBins(ctx, buf, 1, identity, 50, 'blue', bpToX, 200)

    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(0)
  })

  it('does nothing with zero bins', () => {
    const { ctx, calls } = makeCtx()
    drawCoverageBins(
      ctx,
      new ArrayBuffer(0),
      0,
      identity,
      50,
      'blue',
      () => 0,
      200,
    )
    expect(calls.length).toBe(0)
  })
})

describe('drawSnpSegments', () => {
  it('draws segments with correct colors', () => {
    const buf = new ArrayBuffer(16)
    const f32 = new Float32Array(buf)
    const u32 = new Uint32Array(buf)
    u32[0] = 100
    f32[1] = 0.5
    f32[2] = 0.3
    f32[3] = 1 // colorType=1 → baseA

    const colors = {
      baseA: 'red',
      baseC: 'blue',
      baseG: 'green',
      baseT: 'yellow',
      mismatch: '',
      deletion: '',
      insertion: '',
    }
    const { ctx, calls } = makeCtx()
    drawSnpSegments(ctx, buf, 1, 1, 50, colors, bp => bp - 100, 200)

    const styleCalls = calls.filter(c => c.method === 'fillStyle')
    expect(styleCalls.some(c => c.args[0] === 'red')).toBe(true)
  })
})

describe('drawModCovSegments', () => {
  function makeModCovBuf(pos: number, yOffset: number, segH: number, r: number, g: number, b: number, a: number) {
    const buf = new ArrayBuffer(16)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    u32[0] = pos
    f32[1] = yOffset
    f32[2] = segH
    // packed ABGR: r in bits 0-7, g in 8-15, b in 16-23, a in 24-31
    u32[3] = (r & 0xff) | ((g & 0xff) << 8) | ((b & 0xff) << 16) | ((a & 0xff) << 24)
    return buf
  }

  it('draws with 1bp width at high zoom', () => {
    const buf = makeModCovBuf(100, 0.5, 0.3, 255, 0, 0, 255)
    const { ctx, calls } = makeCtx()
    // 10px per bp — width should be 10, not 1
    drawModCovSegments(ctx, buf, 1, 1, 50, bp => (bp - 100) * 10, 200)
    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(1)
    const [, , w] = fillCalls[0]!.args as [number, number, number, number]
    expect(w).toBe(10)
  })

  it('clamps width to 1px at low zoom', () => {
    const buf = makeModCovBuf(100, 0.5, 0.3, 255, 0, 0, 255)
    const { ctx, calls } = makeCtx()
    // 0.1px per bp — width should clamp to 1
    drawModCovSegments(ctx, buf, 1, 1, 50, bp => (bp - 100) * 0.1, 200)
    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(1)
    const [, , w] = fillCalls[0]!.args as [number, number, number, number]
    expect(w).toBe(1)
  })

  it('unpacks color correctly', () => {
    const buf = makeModCovBuf(100, 0.5, 0.3, 200, 100, 50, 255)
    const { ctx, calls } = makeCtx()
    drawModCovSegments(ctx, buf, 1, 1, 50, bp => (bp - 100) * 5, 200)
    const styleCalls = calls.filter(c => c.method === 'fillStyle')
    expect(styleCalls[0]?.args[0]).toBe('rgba(200,100,50,1)')
  })
})

describe('drawIndicators', () => {
  const noncovColors = {
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
    drawIndicators(ctx, buf, 2, noncovColors, bp => bp, 200)

    const styleCalls = calls.filter(c => c.method === 'fillStyle')
    expect(styleCalls.some(c => c.args[0] === 'purple')).toBe(true)
    expect(styleCalls.some(c => c.args[0] === 'cyan')).toBe(true)
  })

  it('skips indicators outside viewport', () => {
    const buf = new ArrayBuffer(8)
    const f32 = new Float32Array(buf)
    f32[0] = 300
    f32[1] = 1

    const { ctx, calls } = makeCtx()
    drawIndicators(ctx, buf, 1, noncovColors, bp => bp, 200)

    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(0)
  })
})
