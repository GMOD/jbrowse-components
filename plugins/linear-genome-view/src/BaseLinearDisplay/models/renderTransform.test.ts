import { computeRenderTransform } from './renderTransform.ts'

describe('computeRenderTransform', () => {
  test('fresh (no stale info) → identity scale, viewOffsetX = -viewOffsetPx clamped to 0 when scrolled into genome', () => {
    expect(
      computeRenderTransform({
        lastDrawnOffsetPx: undefined,
        lastDrawnBpPerPx: undefined,
        viewOffsetPx: 500,
        viewBpPerPx: 100,
      }),
    ).toEqual({ scale: 1, viewOffsetX: 0 })
  })

  test('fresh, scrolled left of genome → viewOffsetX = -offsetPx (positive shift)', () => {
    expect(
      computeRenderTransform({
        lastDrawnOffsetPx: -200,
        lastDrawnBpPerPx: 100,
        viewOffsetPx: -200,
        viewBpPerPx: 100,
      }),
    ).toEqual({ scale: 1, viewOffsetX: 200 })
  })

  test('stale-pan only (no zoom): viewOffsetX tracks current offsetPx', () => {
    // last = -100, current = -50 (user panned right by 50 px)
    expect(
      computeRenderTransform({
        lastDrawnOffsetPx: -100,
        lastDrawnBpPerPx: 100,
        viewOffsetPx: -50,
        viewBpPerPx: 100,
      }),
    ).toEqual({ scale: 1, viewOffsetX: 50 })
  })

  test('stale-zoom-in mid-fetch from negative offsetPx (the bug we fixed)', () => {
    // Apex at fetch was at canvas-x = 100. After 2× zoom-in (scale=2), pixel
    // counts double, so the apex's genome-px in current units doubles too —
    // but apex is at genome 0 so apexGenomePx*scale = 0*2 = 0. The triangle
    // anchor moves with offsetPx_now: viewOffsetX = 0 - (-200) = 200.
    expect(
      computeRenderTransform({
        lastDrawnOffsetPx: -100,
        lastDrawnBpPerPx: 200,
        viewOffsetPx: -200,
        viewBpPerPx: 100,
      }),
    ).toEqual({ scale: 2, viewOffsetX: 200 })
  })

  test('stale-zoom-out mid-fetch from positive offsetPx', () => {
    // last = 200 (scrolled into genome at fetch), zoom out 2×.
    // apexGenomePx = max(0, 200) = 200. scale = 0.5.
    // viewOffsetX = 200*0.5 - 100 = 0.
    expect(
      computeRenderTransform({
        lastDrawnOffsetPx: 200,
        lastDrawnBpPerPx: 50,
        viewOffsetPx: 100,
        viewBpPerPx: 100,
      }),
    ).toEqual({ scale: 0.5, viewOffsetX: 0 })
  })

  test('apex never crosses left of canvas-x = -viewOffsetPx for negative-last cases', () => {
    // When data was fetched while scrolled left, apexGenomePx = 0; the apex
    // simply tracks current viewport.
    const r = computeRenderTransform({
      lastDrawnOffsetPx: -500,
      lastDrawnBpPerPx: 100,
      viewOffsetPx: -50,
      viewBpPerPx: 100,
    })
    expect(r.viewOffsetX).toBe(50)
  })
})
