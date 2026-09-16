import { pointMark } from './pointMark.ts'

import type { MarkContext2D } from './types.ts'

const CHROME_SILENT_ARC_LIMIT = 180_000

test('a same-colour run too long for one Chrome path fills in pieces', () => {
  const count = 250_000
  const arcsPerFill: number[] = []
  let arcs = 0
  const ctx = {
    fillStyle: '',
    beginPath() {
      arcs = 0
    },
    fill() {
      arcsPerFill.push(arcs)
    },
    arc() {
      arcs++
    },
    moveTo() {},
    lineTo() {},
    closePath() {},
    rect() {},
  } as unknown as MarkContext2D

  pointMark.paintBlock(
    ctx,
    {
      x: Uint32Array.from({ length: count }, (_, i) => i),
      x2: Uint32Array.from({ length: count }, (_, i) => i + 1),
      y: new Float32Array(count),
      glyph: new Uint8Array(count),
      color: new Uint32Array(count).fill(0xff0000ff),
      count,
    },
    {
      displayedRegionIndex: 0,
      start: 0,
      end: count,
      screenStartPx: 0,
      screenEndPx: 1000,
      reversed: false,
    },
    { canvasWidth: 1000, canvasHeight: 250 },
    { domain: [0, 10], diameterPx: 7 },
  )

  expect(arcsPerFill.reduce((a, b) => a + b, 0)).toBe(count)
  expect(Math.max(...arcsPerFill)).toBeLessThan(CHROME_SILENT_ARC_LIMIT)
})
