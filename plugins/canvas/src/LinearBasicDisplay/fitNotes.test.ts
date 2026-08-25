import { fitDrops, fitLadderNote, labelsFitHint } from './fitNotes.ts'

import type { FitStage } from './fitLadder.ts'

const stage = (level: FitStage['level'], scale = 1) => ({ level, scale })

describe('fitDrops', () => {
  // Outside fit mode the stage is always `full` at scale 1, so this is also
  // the "no note anywhere" case for fixed and grow.
  it('reports nothing at the full rung', () => {
    expect(fitDrops(stage('full'), true, true)).toEqual({
      names: 'none',
      descriptions: false,
      everyLabel: false,
      squeezePct: undefined,
    })
  })

  // A rung drops a RESERVATION; dropping descriptions nobody turned on is not
  // a loss the user can see, so it is not one the note reports.
  it('counts only the label kinds the settings reserved', () => {
    expect(fitDrops(stage('labels'), true, false).descriptions).toBe(false)
    expect(fitDrops(stage('bodies'), false, false)).toEqual({
      names: 'none',
      descriptions: false,
      everyLabel: false,
      squeezePct: undefined,
    })
  })

  it('walks names from some to all down the ladder', () => {
    expect(fitDrops(stage('decimated'), true, true)).toMatchObject({
      names: 'some',
      descriptions: true,
      everyLabel: false,
    })
    expect(fitDrops(stage('bodies'), true, true)).toMatchObject({
      names: 'all',
      descriptions: true,
      everyLabel: true,
    })
  })

  it('calls a names-only setting fully hidden at the bodies rung', () => {
    expect(fitDrops(stage('bodies'), true, false).everyLabel).toBe(true)
    expect(fitDrops(stage('labels'), false, true).everyLabel).toBe(true)
  })

  // A grown stack (scale > 1) and a float-epsilon squeeze both round to 100
  it('reports a squeeze only when it rounds below 100%', () => {
    expect(fitDrops(stage('bodies', 0.384), false, false).squeezePct).toBe(38)
    expect(fitDrops(stage('bodies', 0.999), false, false).squeezePct).toBe(
      undefined,
    )
    expect(fitDrops(stage('full', 1.5), false, false).squeezePct).toBe(
      undefined,
    )
  })
})

describe('fitLadderNote', () => {
  it('is absent when the ladder gave nothing up', () => {
    expect(fitLadderNote(fitDrops(stage('full'), true, true))).toBeUndefined()
  })

  it('names what went and the lever that brings it back', () => {
    expect(fitLadderNote(fitDrops(stage('labels'), true, true))).toBe(
      'descriptions hidden (taller track shows more)',
    )
    expect(fitLadderNote(fitDrops(stage('decimated'), true, true))).toBe(
      'some names + descriptions hidden (taller track shows more)',
    )
    expect(fitLadderNote(fitDrops(stage('bodies', 0.5), true, false))).toBe(
      'names hidden, squeezed to 50% (taller track shows more)',
    )
    expect(fitLadderNote(fitDrops(stage('bodies', 0.5), false, false))).toBe(
      'squeezed to 50% (taller track shows more)',
    )
  })
})

describe('labelsFitHint', () => {
  it('is absent when the ladder gave nothing up', () => {
    expect(labelsFitHint(fitDrops(stage('full'), true, true))).toBeUndefined()
  })

  // The row already names the setting, so the hint says only what of it is
  // not reaching the canvas — "hidden to fit" once none of it is.
  it('says which part of the row went, or that all of it did', () => {
    expect(labelsFitHint(fitDrops(stage('labels'), true, true))).toBe(
      'descriptions hidden to fit',
    )
    expect(labelsFitHint(fitDrops(stage('decimated'), true, false))).toBe(
      'some names hidden to fit',
    )
    expect(labelsFitHint(fitDrops(stage('bodies'), true, true))).toBe(
      'hidden to fit',
    )
    expect(labelsFitHint(fitDrops(stage('labels'), false, true))).toBe(
      'hidden to fit',
    )
  })
})
