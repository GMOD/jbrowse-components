import { applyCoverageOnly, applyTrackModifier } from './applyTrackOpts.ts'

import type { TrackDisplay } from './applyTrackOpts.ts'

// A recording stand-in for a display model. Each setter is a jest.fn so tests
// assert what a modifier dispatched, without spinning up a real MST tree.
function mockDisplay(extra: Record<string, unknown> = {}) {
  return {
    setHeight: jest.fn(),
    setSortedBy: jest.fn(),
    setGroupBy: jest.fn(),
    setColorScheme: jest.fn(),
    setColor: jest.fn(),
    setShowCoverage: jest.fn(),
    setCoverageHeight: jest.fn(),
    setFeatureHeight: jest.fn(),
    setCompactness: jest.fn(),
    setFeatureSpacing: jest.fn(),
    ...extra,
  } as unknown as TrackDisplay
}

describe('applyTrackModifier', () => {
  test('group:type:tag sets a GroupBy object', () => {
    const display = mockDisplay()
    applyTrackModifier(display, 'group', 'tag', 'HP')
    expect(display.setGroupBy).toHaveBeenCalledWith({ type: 'tag', tag: 'HP' })
  })

  test('group with bare type omits tag', () => {
    const display = mockDisplay()
    applyTrackModifier(display, 'group', 'strand', undefined)
    expect(display.setGroupBy).toHaveBeenCalledWith({
      type: 'strand',
      tag: undefined,
    })
  })

  test('group with empty value clears grouping', () => {
    const display = mockDisplay()
    applyTrackModifier(display, 'group', '', undefined)
    expect(display.setGroupBy).toHaveBeenCalledWith(undefined)
  })

  test('height parses a number', () => {
    const display = mockDisplay()
    applyTrackModifier(display, 'height', '400', undefined)
    expect(display.setHeight).toHaveBeenCalledWith(400)
  })

  test('color prefers setColorScheme when present', () => {
    const display = mockDisplay()
    applyTrackModifier(display, 'color', 'tag', 'XS')
    expect(display.setColorScheme).toHaveBeenCalledWith({
      type: 'tag',
      tag: 'XS',
    })
    expect(display.setColor).not.toHaveBeenCalled()
  })

  test('color falls back to setColor when no setColorScheme', () => {
    const display = mockDisplay({ setColorScheme: undefined })
    applyTrackModifier(display, 'color', 'purple', undefined)
    expect(display.setColor).toHaveBeenCalledWith('purple')
  })

  test('featureHeight presets route to setCompactness', () => {
    const display = mockDisplay()
    applyTrackModifier(display, 'featureHeight', 'super-compact', undefined)
    expect(display.setCompactness).toHaveBeenCalledWith('super-compact')
    expect(display.setFeatureHeight).not.toHaveBeenCalled()
  })

  test('featureHeight numeric routes to setFeatureHeight', () => {
    const display = mockDisplay()
    applyTrackModifier(display, 'featureHeight', '4', undefined)
    expect(display.setFeatureHeight).toHaveBeenCalledWith(4)
  })

  test('featureHeight rejects a non-numeric, non-preset value', () => {
    const display = mockDisplay()
    expect(() => {
      applyTrackModifier(display, 'featureHeight', 'bogus', undefined)
    }).toThrow(/Invalid featureHeight/)
  })

  test('unknown modifier warns and does nothing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const display = mockDisplay()
    applyTrackModifier(display, 'colour', 'red', undefined)
    expect(warn).toHaveBeenCalledWith('Warning: unknown track option "colour"')
    warn.mockRestore()
  })

  test('snpcov is a no-op in the modifier dispatch (no warning)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    applyTrackModifier(mockDisplay(), 'snpcov', '', undefined)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('applyCoverageOnly', () => {
  test('snpcov fills the coverage band to the track height', () => {
    const display = mockDisplay({ height: 200 })
    applyCoverageOnly(display, ['snpcov'])
    expect(display.setShowCoverage).toHaveBeenCalledWith(true)
    expect(display.setCoverageHeight).toHaveBeenCalledWith(200)
  })

  test('no snpcov leaves coverage untouched', () => {
    const display = mockDisplay({ height: 200 })
    applyCoverageOnly(display, ['height:200'])
    expect(display.setCoverageHeight).not.toHaveBeenCalled()
  })
})
