import { createTestSession } from '@jbrowse/web/testUtils'

import { applyInitSettings, normalizeTrackLevels } from './initHelpers.ts'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { LinearSyntenyViewInit } from '../types.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// A real view, because the whole mechanism is "ask the model what properties it
// has". A hand-rolled stand-in with the setters on it would pass while proving
// nothing, which is what the per-property tests this file used to carry did.
function view() {
  return createTestSession().addView(
    'LinearSyntenyView',
    {},
  ) as LinearSyntenyViewModel
}

describe('applyInitSettings', () => {
  // The gap this replaced: a property was authorable only once someone
  // remembered to write an arm for it here, and `drawLocationMarkers` shipped
  // without one. None of these names is mentioned anywhere in initHelpers.
  test('applies any declared view property, named nowhere in this module', () => {
    const v = view()
    applyInitSettings(v, {
      views: [],
      drawLocationMarkers: true,
      opacityByIdentity: true,
      lodMode: 'coarse',
      overdrawPx: 42,
      cigarMode: 'matches',
      alpha: 0.55,
    })
    expect(v.drawLocationMarkers).toBe(true)
    expect(v.opacityByIdentity).toBe(true)
    expect(v.lodMode).toBe('coarse')
    expect(v.overdrawPx).toBe(42)
    expect(v.cigarMode).toBe('matches')
    expect(v.alpha).toBe(0.55)
  })

  test('applies a property a composed mixin contributes', () => {
    const v = view()
    applyInitSettings(v, { views: [], colorBy: 'query', showColorLegend: true })
    expect(v.colorBy).toBe('query')
    expect(v.showColorLegend).toBe(true)
  })

  test('false is applied, not read as absent', () => {
    const v = view()
    applyInitSettings(v, { views: [], showColorLegend: true })
    applyInitSettings(v, { views: [], showColorLegend: false })
    expect(v.showColorLegend).toBe(false)
  })

  test('an omitted property keeps its default', () => {
    const v = view()
    applyInitSettings(v, { views: [] })
    expect(v.cigarMode).toBe('full')
    // unset is the inherit state; straight chords is what it resolves to
    expect(v.drawCurves).toBeUndefined()
    expect(v.effectiveDrawCurves).toBe(false)
  })

  // `views` is the reason commands are skipped by name rather than by "is it a
  // property": the spec's is a list of assemblies to open, the model's is the
  // rows built from them.
  test('the spec commands are left alone, including the ones that shadow a property', () => {
    const v = view()
    applyInitSettings(v, {
      views: [{ assembly: 'volvox' }],
      tracks: ['a_track'],
      autoDiagonalize: true,
      sameScale: true,
      collapseEmptyRows: true,
    })
    expect(v.views).toHaveLength(0)
  })

  test('an unrecognized key is reported and changes nothing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const v = view()
    // cast: the static type rejects this, which is the point — the runtime
    // guard is for JSON off a URL, which has no static type at all
    applyInitSettings(v, {
      views: [],
      drawCurvez: true,
    } as LinearSyntenyViewInit)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('unknown key(s): drawCurvez'),
    )
    warn.mockRestore()
  })

  // An init blob comes off a URL, so one bad value costs that key and no more.
  test('a value the property rejects is dropped, and its neighbours still land', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const v = view()
    applyInitSettings(v, {
      views: [],
      alpha: 'loud',
      drawCurves: true,
    } as unknown as LinearSyntenyViewInit)
    expect(v.alpha).toBe(0.2)
    expect(v.drawCurves).toBe(true)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid value: alpha'),
    )
    warn.mockRestore()
  })
})

describe('normalizeTrackLevels', () => {
  test('flat string[] is shorthand for a single level-0 list', () => {
    expect(normalizeTrackLevels(['a', 'b'])).toEqual([['a', 'b']])
  })

  test('string[][] is kept as one entry per level', () => {
    expect(normalizeTrackLevels([['a'], ['b', 'c']])).toEqual([
      ['a'],
      ['b', 'c'],
    ])
  })

  test('single-element flat list stays one level, not one-per-track', () => {
    expect(normalizeTrackLevels(['only'])).toEqual([['only']])
  })

  test('empty input yields no levels', () => {
    expect(normalizeTrackLevels([])).toEqual([])
  })
})
