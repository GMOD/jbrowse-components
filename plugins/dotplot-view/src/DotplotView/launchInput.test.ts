import { createTestSession } from '@jbrowse/web/testUtils'

import type { DotplotViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

let warn: jest.SpyInstance

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

const warnings = () => warn.mock.calls.map(c => `${c[0]}`)

function open(snap: Record<string, unknown>) {
  return createTestSession().addView('DotplotView', snap) as DotplotViewModel
}

const AXES = [{ assembly: 'volvox' }, { assembly: 'volvox2' }]

// `views` collides with nothing here — the model declares `hview`/`vview` and
// derives `views` — so the lift is unconditional.
test('a launch key written on the view object reaches the launch state', () => {
  const view = open({ views: AXES, tracks: ['a_track'], autoDiagonalize: true })
  expect(view.launch).toEqual({
    views: AXES,
    tracks: ['a_track'],
    autoDiagonalize: true,
  })
  expect(view.hview.displayedRegions).toHaveLength(0)
  expect(warnings()).toEqual([])
})

// The hand-written switchboard this replaced covered showColorLegend, colorBy
// and minAlignmentLength out of a model that also declares these; the rest were
// never authorable at all.
test('any declared property lands natively, named nowhere in the launch path', () => {
  const view = open({
    views: AXES,
    alpha: 0.55,
    drawCigar: false,
    lineWidth: 3,
    lockAspectRatio: false,
    lodMode: 'coarse',
    colorBy: 'query',
    minAlignmentLength: 1000,
  })
  expect(view.alpha).toBe(0.55)
  expect(view.drawCigar).toBe(false)
  expect(view.lineWidth).toBe(3)
  expect(view.lockAspectRatio).toBe(false)
  expect(view.lodMode).toBe('coarse')
  expect(view.colorBy).toBe('query')
  expect(view.minAlignmentLength).toBe(1000)
  expect(view.launch).toEqual({ views: AXES })
})

describe('the v4 nested form', () => {
  test('a nested spec produces the same view as the flat one, and says so', () => {
    const nested = open({ init: { views: AXES, tracks: ['a_track'] } })
    expect(nested.launch).toEqual({
      ...open({ views: AXES, tracks: ['a_track'] }).launch,
      legacyInit: true,
    })
    expect(warnings()).toContain(
      'DotplotView nests its settings under "init", which is deprecated: write every setting directly on the view object.',
    )
  })

  // `scripts/build_oat_homoeologs.sh` ships `"init": { …, "colorBy": "dnds" }`,
  // and v4's applyInitSettings applied it.
  test('a declared property nested inside it still lands', () => {
    const view = open({ init: { views: AXES, colorBy: 'dnds' } })
    expect(view.colorBy).toBe('dnds')
    expect(warnings()).not.toContain(
      'DotplotView ignored unknown key(s): colorBy',
    )
  })
})

test('a key naming neither a launch key nor a property is named on attach', () => {
  open({ views: AXES, colorBz: 'query' })
  expect(warnings()).toContain('DotplotView ignored unknown key(s): colorBz')
})

test('an unknown key is reported once, not once per capture', () => {
  open({ colorBz: 'query' })
  expect(warnings()).toHaveLength(1)
})

// Read as work to do, `hasSomethingToShow` is true with no axes coming and the
// plot sits on its spinner rather than dropping to the import form.
test('a typo alone leaves nothing pending', () => {
  const view = open({ colorBz: 'query' })
  expect(view.launch).toEqual({ unknown: { colorBz: 'query' } })
  expect(view.init).toBeUndefined()
  expect(view.hasSomethingToShow).toBe(false)
})

describe('the track entries discriminator', () => {
  test('a trackId string is a recipe', () => {
    expect(open({ views: AXES, tracks: ['a_track'] }).launch).toEqual({
      views: AXES,
      tracks: ['a_track'],
    })
  })

  test('a built track snapshot stays on the state property', () => {
    const view = open({
      views: AXES,
      tracks: [{ type: 'SyntenyTrack', configuration: 'volvox_fake_synteny' }],
    })
    expect(view.launch).toEqual({ views: AXES })
    expect(view.tracks).toHaveLength(1)
  })

  test('a mixed list splits per entry', () => {
    const view = open({
      views: AXES,
      tracks: [
        'a_track',
        { type: 'SyntenyTrack', configuration: 'volvox_fake_synteny' },
      ],
    })
    expect(view.launch).toEqual({ views: AXES, tracks: ['a_track'] })
    expect(view.tracks).toHaveLength(1)
  })
})

describe('the highlight discriminator', () => {
  const persisted = {
    refName: 'ctgA',
    start: 1,
    end: 2,
    assemblyName: 'volvox',
  }

  test('a locstring needs the assembly manager, so it launches', () => {
    expect(open({ views: AXES, highlight: ['ctgA:1-100'] }).launch).toEqual({
      views: AXES,
      highlight: ['ctgA:1-100'],
    })
  })

  test('an object is the persisted shape and stays on the property', () => {
    const view = open({ views: AXES, highlight: [persisted] })
    expect(view.launch).toEqual({ views: AXES })
    expect(view.highlight).toHaveLength(1)
  })
})
