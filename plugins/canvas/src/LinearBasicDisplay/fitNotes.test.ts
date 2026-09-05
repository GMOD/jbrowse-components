import { fitDrops, fitLadderNote, labelsFitHint } from './fitNotes.ts'

import type { FitStage } from './fitLadder.ts'

const stage = (
  level: FitStage['level'],
  scale = 1,
  { fixed = false } = {},
): Pick<
  FitStage,
  'level' | 'scale' | 'showLabels' | 'showDescriptions' | 'dropBelowLabelRows'
> => ({
  level,
  scale,
  showLabels: level !== 'bodies' && level !== 'bare',
  showDescriptions: level === 'full' || (level === 'isoforms' && fixed),
  dropBelowLabelRows: level === 'bare',
})

const drops = (
  at: ReturnType<typeof stage>,
  showLabels: boolean,
  showDescriptions: boolean,
  decimatedFactor = 1,
) => fitDrops(at, showLabels, showDescriptions, decimatedFactor)

describe('fitDrops', () => {
  it('reports nothing at the full rung', () => {
    expect(drops(stage('full'), true, true)).toEqual({
      names: 'none',
      descriptions: false,
      subfeatureLabels: false,
      everyLabel: false,
      squeezePct: undefined,
    })
  })

  it('counts only the label kinds the settings reserved', () => {
    expect(drops(stage('labels'), true, false).descriptions).toBe(false)
    expect(drops(stage('bodies'), false, false)).toEqual({
      names: 'none',
      descriptions: false,
      subfeatureLabels: false,
      everyLabel: false,
      squeezePct: undefined,
    })
  })

  it('reports nothing when a fixed track trims isoforms', () => {
    expect(
      fitDrops(stage('isoforms', 1, { fixed: true }), true, true, undefined),
    ).toEqual({
      names: 'none',
      descriptions: false,
      subfeatureLabels: false,
      everyLabel: false,
      squeezePct: undefined,
    })
  })

  it('reports the below-label rows dropped at the bare rung', () => {
    expect(drops(stage('bare'), true, false)).toMatchObject({
      names: 'all',
      subfeatureLabels: true,
      everyLabel: true,
    })
    expect(drops(stage('bare'), false, false).subfeatureLabels).toBe(true)
  })

  it('reports no names hidden at a decimated factor of 0', () => {
    expect(drops(stage('decimated'), true, false, 0).names).toBe('none')
    expect(fitLadderNote(drops(stage('decimated'), true, false, 0))).toBe(
      undefined,
    )
    expect(drops(stage('decimated'), true, false, 0.5).names).toBe('some')
  })

  it('walks names from some to all down the ladder', () => {
    expect(drops(stage('decimated'), true, true)).toMatchObject({
      names: 'some',
      descriptions: true,
      everyLabel: false,
    })
    expect(drops(stage('bodies'), true, true)).toMatchObject({
      names: 'all',
      descriptions: true,
      everyLabel: true,
    })
  })

  it('calls a names-only setting fully hidden at the bodies rung', () => {
    expect(drops(stage('bodies'), true, false).everyLabel).toBe(true)
    expect(drops(stage('labels'), false, true).everyLabel).toBe(true)
  })

  it('reports a squeeze only when it rounds below 100%', () => {
    expect(drops(stage('bodies', 0.384), false, false).squeezePct).toBe(38)
    expect(drops(stage('bodies', 0.999), false, false).squeezePct).toBe(
      undefined,
    )
    expect(drops(stage('full', 1.5), false, false).squeezePct).toBe(undefined)
  })
})

describe('fitLadderNote', () => {
  it('is absent when the ladder gave nothing up', () => {
    expect(fitLadderNote(drops(stage('full'), true, true))).toBeUndefined()
  })

  it('names what went and the lever that brings it back', () => {
    expect(fitLadderNote(drops(stage('labels'), true, true))).toBe(
      'descriptions hidden (taller track shows more)',
    )
    expect(fitLadderNote(drops(stage('decimated'), true, true))).toBe(
      'some names + descriptions hidden (taller track shows more)',
    )
    expect(fitLadderNote(drops(stage('bodies', 0.5), true, false))).toBe(
      'names hidden, squeezed to 50% (taller track shows more)',
    )
    expect(fitLadderNote(drops(stage('bodies', 0.5), false, false))).toBe(
      'squeezed to 50% (taller track shows more)',
    )
    expect(fitLadderNote(drops(stage('bare'), true, false))).toBe(
      'names + subfeature labels hidden (taller track shows more)',
    )
  })
})

describe('labelsFitHint', () => {
  it('is absent when the ladder gave nothing up', () => {
    expect(labelsFitHint(drops(stage('full'), true, true))).toBeUndefined()
  })

  it('says which part of the row went, or that all of it did', () => {
    expect(labelsFitHint(drops(stage('labels'), true, true))).toBe(
      'descriptions hidden to fit',
    )
    expect(labelsFitHint(drops(stage('decimated'), true, false))).toBe(
      'some names hidden to fit',
    )
    expect(labelsFitHint(drops(stage('bodies'), true, true))).toBe(
      'hidden to fit',
    )
    expect(labelsFitHint(drops(stage('labels'), false, true))).toBe(
      'hidden to fit',
    )
  })

  it('leaves the subfeature-label drop to the track-sizing note', () => {
    expect(labelsFitHint(drops(stage('bare'), false, false))).toBeUndefined()
  })
})
