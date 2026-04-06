import { WiggleRenderer } from './WiggleRenderer.ts'

describe('WiggleRenderer.getOrCreate', () => {
  test('returns a renderer for a canvas', () => {
    const canvas = document.createElement('canvas')
    const r = WiggleRenderer.getOrCreate(canvas)
    expect(r).toBeDefined()
  })

  test('returns different renderer for different canvas', () => {
    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')
    const r1 = WiggleRenderer.getOrCreate(canvas1)
    const r2 = WiggleRenderer.getOrCreate(canvas2)
    expect(r1).not.toBe(r2)
  })
})
