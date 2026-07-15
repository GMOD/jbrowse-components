import { applyInitSettings, normalizeTrackLevels } from './initHelpers.ts'

import type { LinearSyntenyViewModel } from '../model.ts'

// A minimal stand-in recording which one-time-on-load setters applyInitSettings
// invokes; the real model's setters just assign observable props.
function makeModel() {
  const calls: Record<string, unknown> = {}
  return {
    calls,
    setColorBy: (v: string) => {
      calls.colorBy = v
    },
    setShowColorLegend: (v: boolean) => {
      calls.showColorLegend = v
    },
    setMinAlignmentLength: (v: number) => {
      calls.minAlignmentLength = v
    },
    setDrawCurves: (v: boolean) => {
      calls.drawCurves = v
    },
    setCigarMode: (v: string) => {
      calls.cigarMode = v
    },
    setAlpha: (v: number) => {
      calls.alpha = v
    },
    setFadeThinAlignments: (v: boolean) => {
      calls.fadeThinAlignments = v
    },
    levels: [],
  }
}

describe('applyInitSettings', () => {
  test('applies showColorLegend:false (guarded on !== undefined, not truthiness)', () => {
    const model = makeModel()
    applyInitSettings(model as unknown as LinearSyntenyViewModel, {
      views: [],
      showColorLegend: false,
    })
    expect(model.calls.showColorLegend).toBe(false)
  })

  test('leaves showColorLegend untouched when omitted', () => {
    const model = makeModel()
    applyInitSettings(model as unknown as LinearSyntenyViewModel, { views: [] })
    expect('showColorLegend' in model.calls).toBe(false)
  })

  test('applies colorBy when set', () => {
    const model = makeModel()
    applyInitSettings(model as unknown as LinearSyntenyViewModel, {
      views: [],
      colorBy: 'reference',
    })
    expect(model.calls.colorBy).toBe('reference')
  })

  test('applies cigarMode when set (session-authorable transparent indels)', () => {
    const model = makeModel()
    applyInitSettings(model as unknown as LinearSyntenyViewModel, {
      views: [],
      cigarMode: 'matches',
    })
    expect(model.calls.cigarMode).toBe('matches')
  })

  test('leaves cigarMode untouched when omitted', () => {
    const model = makeModel()
    applyInitSettings(model as unknown as LinearSyntenyViewModel, { views: [] })
    expect('cigarMode' in model.calls).toBe(false)
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
