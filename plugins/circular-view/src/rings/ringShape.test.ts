import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import { ringShape } from './ringShape.ts'
import { annulusRects, warpRing } from './warpRing.ts'

import type { RingChannels, RingParams } from './ringShape.ts'
import type { Annulus } from './warpRing.ts'

function setDpr(value: number) {
  Object.defineProperty(globalThis, 'devicePixelRatio', {
    value,
    writable: true,
    configurable: true,
  })
}

afterEach(() => {
  setDpr(1)
})

function canvas2d(width: number, height: number) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c.getContext('2d', { willReadFrequently: true })!
}

// Bars of random height and alpha, so both the warp's bilinear blend and its
// unpremultiplied output reach the comparison.
function randomStrip(width: number, height: number, seed: number) {
  const ctx = canvas2d(width, height)
  let s = seed
  const rand = () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648
    return s / 2_147_483_648
  }
  for (let x = 0; x < width; x += 3) {
    const h = Math.floor(rand() * height)
    ctx.fillStyle = `rgba(${Math.floor(rand() * 255)}, 40, ${Math.floor(rand() * 255)}, ${rand().toFixed(2)})`
    ctx.fillRect(x, height - h, 3, h)
  }
  return { image: ctx.canvas, width, height }
}

// The painter as it stood before it confined itself to the annulus: clear,
// put and draw the outer rim's whole bounding square.
function paintWholeSquare(
  ctx: CanvasRenderingContext2D,
  channels: RingChannels,
  canvasWidth: number,
  canvasHeight: number,
  params: RingParams,
  dpr: number,
) {
  const strip = params.strip!
  const pixels = canvas2d(strip.width, strip.height)
  pixels.drawImage(strip.image, 0, 0)
  const src = pixels.getImageData(0, 0, strip.width, strip.height)
  const cx = params.centerX * dpr
  const cy = params.centerY * dpr
  for (let i = 0; i < channels.count; i++) {
    const outerPx = channels.outerPx[i]! * dpr
    const left = Math.max(0, Math.floor(cx - outerPx - 1))
    const top = Math.max(0, Math.floor(cy - outerPx - 1))
    const right = Math.min(canvasWidth * dpr, cx + outerPx + 1)
    const bottom = Math.min(canvasHeight * dpr, cy + outerPx + 1)
    if (right - left < 1 || bottom - top < 1) {
      continue
    }
    const out = canvas2d(Math.ceil(right - left), Math.ceil(bottom - top))
    const ring = out.createImageData(out.canvas.width, out.canvas.height)
    warpRing(ring, src, {
      centerX: cx - left,
      centerY: cy - top,
      innerPx: channels.innerPx[i]! * dpr,
      outerPx,
      offsetRadians: params.offsetRadians,
    })
    out.putImageData(ring, 0, 0)
    ctx.drawImage(
      out.canvas,
      0,
      0,
      ring.width,
      ring.height,
      left / dpr,
      top / dpr,
      ring.width / dpr,
      ring.height / dpr,
    )
  }
}

function target(cssW: number, cssH: number, dpr: number) {
  const ctx = canvas2d(Math.round(cssW * dpr), Math.round(cssH * dpr))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

const CASES = [
  // one ring, centred
  { w: 400, h: 400, cx: 200, cy: 200, rings: [[150, 190]] },
  // two rings, the inner one thin
  {
    w: 400,
    h: 300,
    cx: 200,
    cy: 150,
    rings: [
      [60, 64.5],
      [100, 140],
    ],
  },
  // a fractional centre whose circle runs off three edges
  { w: 300, h: 200, cx: 271.3, cy: 17.7, rings: [[80.2, 130.9]] },
  // a disc: no hole at all
  { w: 200, h: 200, cx: 90, cy: 110, rings: [[0, 70]] },
  // wholly off the canvas
  { w: 200, h: 200, cx: -500, cy: 100, rings: [[10, 50]] },
] as const

test.each([1, 1.5, 2])(
  'at dpr %s the painter draws the pixels the whole-square paint drew, frame after frame',
  dpr => {
    setDpr(dpr)
    const strip = randomStrip(1300, 40, 7)
    for (const c of CASES) {
      const channels = {
        innerPx: Float32Array.from(c.rings.map(r => r[0])),
        outerPx: Float32Array.from(c.rings.map(r => r[1])),
        count: c.rings.length,
      }
      for (const offsetRadians of [0, 0.37, 2.9, -1.1]) {
        const params = { centerX: c.cx, centerY: c.cy, offsetRadians, strip }
        const expected = target(c.w, c.h, dpr)
        paintWholeSquare(expected, channels, c.w, c.h, params, dpr)
        const actual = target(c.w, c.h, dpr)
        ringShape('ring0').paintBlock(
          actual,
          channels,
          canvasWideBlocks([0], c.w)[0]!,
          { canvasWidth: c.w, canvasHeight: c.h },
          params,
        )
        const { width, height } = actual.canvas
        const a = actual.getImageData(0, 0, width, height).data
        const e = expected.getImageData(0, 0, width, height).data
        let differ = 0
        for (let k = 0; k < a.length; k++) {
          if (a[k] !== e[k]) {
            differ++
          }
        }
        expect(differ).toBe(0)
      }
    }
  },
)

test('annulusRects holds every pixel warpRing writes', () => {
  const strip = {
    data: new Uint8ClampedArray(64 * 8 * 4).fill(255),
    width: 64,
    height: 8,
  }
  const rings: [number, number, Annulus][] = []
  for (const [cx, cy] of [
    [50, 50],
    [50.5, 49.25],
    [-7.3, 61.9],
    [99.9, 3.1],
  ]) {
    for (const [inner, outer] of [
      [0, 30],
      [0.3, 12.2],
      [20, 21],
      [29.5, 45.25],
      [44, 90],
    ]) {
      rings.push([
        100,
        100,
        {
          centerX: cx!,
          centerY: cy!,
          innerPx: inner!,
          outerPx: outer!,
          offsetRadians: 1,
        },
      ])
    }
  }
  for (const [w, h, ring] of rings) {
    const out = { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
    warpRing(out, strip, ring)
    for (const bandRows of [1, 7, 64]) {
      const inside = new Uint8Array(w * h)
      for (const r of annulusRects(w, h, ring, bandRows)) {
        expect(r.x).toBeGreaterThanOrEqual(0)
        expect(r.y).toBeGreaterThanOrEqual(0)
        expect(r.x + r.width).toBeLessThanOrEqual(w)
        expect(r.y + r.height).toBeLessThanOrEqual(h)
        for (let y = r.y; y < r.y + r.height; y++) {
          for (let x = r.x; x < r.x + r.width; x++) {
            inside[y * w + x]++
          }
        }
      }
      const missed = []
      for (let p = 0; p < w * h; p++) {
        if (out.data[p * 4 + 3]! > 0 && !inside[p]) {
          missed.push(p)
        }
      }
      expect(missed).toEqual([])
      expect(inside.every(n => n <= 1)).toBe(true)
    }
  }
})

test('a thin ring on a wide canvas puts a sliver of its bounding square', () => {
  const ring = {
    centerX: 2000,
    centerY: 2000,
    innerPx: 1900,
    outerPx: 2000,
    offsetRadians: 0,
  }
  const area = annulusRects(4000, 4000, ring, 64).reduce(
    (sum, r) => sum + r.width * r.height,
    0,
  )
  const annulus = Math.PI * (2000 ** 2 - 1900 ** 2)
  expect(area / annulus).toBeLessThan(2)
  expect(area / 4000 ** 2).toBeLessThan(0.12)
})
