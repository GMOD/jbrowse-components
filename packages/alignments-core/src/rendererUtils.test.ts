import {
  coverageLayout,
  drawCoverageBins,
  drawIndicators,
  drawSnpSegments,
  rgbaString,
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
  it('computes depth scale, effective height, and bottom', () => {
    const layout = coverageLayout(100, 50)
    expect(layout.effectiveH).toBe(40) // 50 - 2*5
    expect(layout.bottom).toBe(45) // 50 - 5
    expect(layout.depthScale).toBe(1) // 100/niceNum(100)=100/100=1
  })

  it('handles non-nice max depth', () => {
    const layout = coverageLayout(73, 50)
    expect(layout.depthScale).toBeCloseTo(73 / 100) // niceNum(73)=100
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

describe('rgbaString', () => {
  it('converts normalized floats to CSS rgba', () => {
    expect(rgbaString(1, 0, 0, 1)).toBe('rgba(255,0,0,1.000)')
    expect(rgbaString(0.5, 0.5, 0.5, 0.5)).toBe('rgba(128,128,128,0.500)')
  })
})

describe('drawCoverageBins', () => {
  it('draws bins as rectangles', () => {
    const buf = new ArrayBuffer(2 * 12)
    const f32 = new Float32Array(buf)
    // bin 0: pos=100, min=0.2, max=0.8
    f32[0] = 100
    f32[1] = 0.2
    f32[2] = 0.8
    // bin 1: pos=101, min=0.1, max=0.5
    f32[3] = 101
    f32[4] = 0.1
    f32[5] = 0.5

    const { ctx, calls } = makeCtx()
    const bpToX = (bp: number) => (bp - 100) * 10

    drawCoverageBins(ctx, buf, 2, 100, 50, 'blue', bpToX, 200)

    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(2)
  })

  it('skips bins outside viewport', () => {
    const buf = new ArrayBuffer(12)
    const f32 = new Float32Array(buf)
    f32[0] = 1000
    f32[1] = 0.5
    f32[2] = 0.5

    const { ctx, calls } = makeCtx()
    const bpToX = (bp: number) => (bp - 1000) * 10 + 500

    drawCoverageBins(ctx, buf, 1, 100, 50, 'blue', bpToX, 200)

    const fillCalls = calls.filter(c => c.method === 'fillRect')
    expect(fillCalls.length).toBe(0)
  })

  it('does nothing with zero bins or zero maxDepth', () => {
    const { ctx, calls } = makeCtx()
    drawCoverageBins(ctx, new ArrayBuffer(0), 0, 100, 50, 'blue', () => 0, 200)
    expect(calls.length).toBe(0)
    drawCoverageBins(ctx, new ArrayBuffer(12), 1, 0, 50, 'blue', () => 0, 200)
    expect(calls.length).toBe(0)
  })
})

describe('drawSnpSegments', () => {
  it('draws segments with correct colors', () => {
    const buf = new ArrayBuffer(16)
    const f32 = new Float32Array(buf)
    f32[0] = 100
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
    drawSnpSegments(ctx, buf, 1, 100, 50, colors, bp => bp - 100, 200)

    const styleCalls = calls.filter(c => c.method === 'fillStyle')
    expect(styleCalls.some(c => c.args[0] === 'red')).toBe(true)
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
    f32[0] = 50
    f32[1] = 1 // insertion
    f32[2] = 150
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
