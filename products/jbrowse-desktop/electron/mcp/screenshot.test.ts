/**
 * @jest-environment node
 *
 * The parts of the capture that are arithmetic. The Electron half — capturePage
 * and the devtools clip — is pinned by test/mcpConformance.ts against the built
 * app; everything here used to live inside bridge.ts, where nothing could reach
 * it without an Electron runtime.
 */
import {
  cropTo,
  documentRect,
  isMeasured,
  isRect,
  pngSize,
  requestedScale,
} from './screenshot.ts'

jest.mock('electron', () => ({ nativeImage: {} }))

const page = { x: 0, y: 0, width: 1600, height: 1000 }

describe('cropTo', () => {
  it('rounds a fractional box outward and clamps it to the page', () => {
    expect(
      cropTo({ x: 10.4, y: 20.6, width: 100.2, height: 50.1 }, page).rect,
    ).toEqual({ x: 10, y: 20, width: 101, height: 51 })
  })

  it('trims a box that hangs past the edge', () => {
    expect(
      cropTo({ x: 1500, y: 0, width: 400, height: 10 }, page).rect,
    ).toEqual({ x: 1500, y: 0, width: 100, height: 10 })
  })

  // clamping it answered with a 1px sliver under a `cropped` field naming the
  // box that was asked for: a picture of nothing, and no reason given
  it('refuses a box that starts past the page rather than answering a sliver', () => {
    const { rect, error } = cropTo(
      { x: 1700, y: 0, width: 100, height: 100 },
      page,
    )
    expect(rect).toBeUndefined()
    expect(error).toMatch(/falls outside the 1600x1000 page/)
  })

  it('refuses a box with no height left', () => {
    expect(
      cropTo({ x: 0, y: 1000, width: 10, height: 10 }, page).error,
    ).toMatch(/falls outside/)
  })
})

describe('documentRect', () => {
  it('re-addresses a viewport box against a scrolled page', () => {
    expect(
      documentRect({
        x: 10,
        y: -40,
        width: 100,
        height: 200,
        scrollX: 0,
        scrollY: 300,
      }),
    ).toEqual({ x: 10, y: 260, width: 100, height: 200 })
  })
})

describe('isRect / isMeasured', () => {
  const rect = { x: 0, y: 0, width: 1, height: 1 }
  it('accepts a full rectangle and rejects a partial one', () => {
    expect(isRect(rect)).toBe(true)
    expect(isRect({ x: 0, y: 0, width: 1 })).toBe(false)
    expect(isRect(null)).toBe(false)
  })

  it('needs the scroll offset before a rectangle counts as measured', () => {
    expect(isMeasured(rect)).toBe(false)
    expect(isMeasured({ ...rect, scrollX: 0, scrollY: 0 })).toBe(true)
  })
})

describe('requestedScale', () => {
  it('defaults to one image pixel per CSS pixel', () => {
    expect(requestedScale(undefined)).toBe(1)
    expect(requestedScale('2')).toBe(1)
    expect(requestedScale(0)).toBe(1)
  })

  it('clamps what it is given', () => {
    expect(requestedScale(2)).toBe(2)
    expect(requestedScale(99)).toBe(4)
    expect(requestedScale(0.01)).toBe(0.1)
  })
})

describe('pngSize', () => {
  it('reads the IHDR dimensions', () => {
    const png = Buffer.alloc(24)
    png.writeUInt32BE(1234, 16)
    png.writeUInt32BE(567, 20)
    expect(pngSize(png)).toEqual({ width: 1234, height: 567 })
  })
})
