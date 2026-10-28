/**
 * @jest-environment node
 *
 * The parts of the capture that are arithmetic. The Electron half — capturePage
 * and the devtools clip — is pinned by test/mcpConformance.ts against the built
 * app; everything here used to live inside bridge.ts, where nothing could reach
 * it without an Electron runtime.
 */
import {
  captureFullPage,
  cropTo,
  documentRect,
  errorAfterSettle,
  isMeasured,
  isRect,
  mergeSettles,
  overflowOf,
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

describe('overflowOf', () => {
  it('is how far the settle measured the session past the window', () => {
    expect(
      overflowOf({
        result: { offscreen: { pageHeight: 1186.4, windowHeight: 1000 } },
      }),
    ).toBe(187)
  })
  it('is zero when the settle reported no overflow', () => {
    expect(overflowOf({ result: { settled: true } })).toBe(0)
    expect(overflowOf({ error: 'timed out' })).toBe(0)
  })
})

// A full-page capture settles twice, the second time after growing the
// viewport; dropping that one lost what it drained and kept the pre-grow
// offscreen report, which invited another attempt.
describe('mergeSettles', () => {
  const first = {
    result: {
      settled: true,
      offscreen: { pageHeight: 1800, windowHeight: 800 },
      notifications: ['one'],
      pageErrors: ['early'],
    },
  }

  it('takes the grown state and joins what each settle delivered once', () => {
    expect(
      mergeSettles(first, {
        result: { settled: true, notifications: ['two'] },
      }),
    ).toEqual({
      result: {
        settled: true,
        notifications: ['one', 'two'],
        pageErrors: ['early'],
      },
    })
  })

  it('keeps the first when the second failed or never ran', () => {
    expect(mergeSettles(first, { error: 'timed out' })).toBe(first)
    expect(mergeSettles(first, undefined)).toBe(first)
  })
})

// a failed measure or capture came after the settle had spent these, so an
// error answer without them lost them for good
describe('errorAfterSettle', () => {
  it('carries what the settle delivered once', () => {
    const { error } = errorAfterSettle('nothing on the page matches "x"', {
      result: {
        settled: true,
        notifications: [{ level: 'error', message: 'track failed' }],
        pageErrors: [],
      },
    })
    expect(error).toBe(
      'nothing on the page matches "x"\nnotifications: [{"level":"error","message":"track failed"}]',
    )
  })

  it('is the bare error after a settle that itself failed', () => {
    expect(errorAfterSettle('no window', { error: 'timed out' })).toEqual({
      error: 'no window',
    })
  })
})

describe('captureFullPage', () => {
  // a renderer gone mid-capture fails the settle and then the viewport reset;
  // the debugger still has to come off, or every later fullPage is refused as
  // "something else is holding it"
  it('detaches the debugger when resetting the viewport throws', async () => {
    const detach = jest.fn()
    const sendCommand = jest.fn(async (method: string) => {
      if (method === 'Page.getLayoutMetrics') {
        return { cssLayoutViewport: { clientWidth: 800, clientHeight: 600 } }
      }
      if (method === 'Emulation.clearDeviceMetricsOverride') {
        throw new Error('target closed')
      }
      return {}
    })
    const contents = {
      debugger: { attach: jest.fn(), detach, sendCommand },
    } as unknown as Parameters<typeof captureFullPage>[0]
    const relay = jest.fn(async () => {
      throw new Error('renderer gone')
    })

    await expect(captureFullPage(contents, {}, 1, relay, 200)).rejects.toThrow()
    expect(sendCommand).toHaveBeenCalledWith(
      'Emulation.clearDeviceMetricsOverride',
    )
    expect(detach).toHaveBeenCalled()
  })
})
