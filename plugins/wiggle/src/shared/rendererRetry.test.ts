import { WiggleRenderer } from './WiggleRenderer.ts'

describe('WiggleRenderer', () => {
  test('returns a promise for a canvas', () => {
    const canvas = document.createElement('canvas')
    const result = WiggleRenderer(canvas)
    expect(result).toBeInstanceOf(Promise)
  })

  test('returns different promises for different canvases', () => {
    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')
    const r1 = WiggleRenderer(canvas1)
    const r2 = WiggleRenderer(canvas2)
    expect(r1).not.toBe(r2)
  })
})
