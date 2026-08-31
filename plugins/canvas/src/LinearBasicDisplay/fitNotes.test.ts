import { fitDrops, fitLadderNote, labelsFitHint } from './fitNotes.ts'

import type { FitStage } from './fitLadder.ts'

const stage = (level: FitStage['level'], scale = 1) => ({ level, scale })

// Fit mode paints descriptions at `full` and at no rung below it, which is what
// the display's `renderedShowDescriptions` answers — spelled once here so each
// case below reads as the rung it is about. The fixed-height ladder is the one
// that reaches `isoforms` still painting them, and has a case of its own.
const drops = (
  at: ReturnType<typeof stage>,
  showLabels: boolean,
  showDescriptions: boolean,
  // the factor the `decimated` rung committed at; above 0 by default, since a
  // rung that reached 0 dropped no name and has a case of its own below
  decimatedFactor = 1,
) =>
  fitDrops(
    at,
    showLabels,
    showDescriptions,
    at.level === 'full',
    decimatedFactor,
    at.level === 'bare',
  )

describe('fitDrops', () => {
  // Outside fit mode the stage is always `full` at scale 1, so this is also
  // the "no note anywhere" case for fixed and grow.
  it('reports nothing at the full rung', () => {
    expect(drops(stage('full'), true, true)).toEqual({
      names: 'none',
      descriptions: false,
      subfeatureLabels: false,
      everyLabel: false,
      squeezePct: undefined,
    })
  })

  // A rung drops a RESERVATION; dropping descriptions nobody turned on is not
  // a loss the user can see, so it is not one the note reports.
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

  // Fixed height runs `full -> isoforms`: it gives up transcripts rather than
  // labels, so a track that lands there has dropped no label kind at all and
  // the note stays silent.
  it('reports nothing when a fixed track trims isoforms', () => {
    expect(
      fitDrops(stage('isoforms'), true, true, true, undefined, false),
    ).toEqual({
      names: 'none',
      descriptions: false,
      subfeatureLabels: false,
      everyLabel: false,
      squeezePct: undefined,
    })
  })

  // The `bare` rung exists only where the settings reserve `below` label rows,
  // so landing on it always means both every name and those rows went.
  it('reports the below-label rows dropped at the bare rung', () => {
    expect(drops(stage('bare'), true, false)).toMatchObject({
      names: 'all',
      subfeatureLabels: true,
      everyLabel: true,
    })
    expect(drops(stage('bare'), false, false).subfeatureLabels).toBe(true)
  })

  // The `decimated` rung commits at factor 0 whenever the unseeded pack fits
  // where the seeded `labels` pack did not, and factor 0 keeps every name
  // (`keepFeatureLabel` asks for `room >= width * 0`). The note said "some
  // names hidden" over a track drawing all of them.
  it('reports no names hidden at a decimated factor of 0', () => {
    expect(drops(stage('decimated'), true, false, 0).names).toBe('none')
    expect(fitLadderNote(drops(stage('decimated'), true, false, 0))).toBe(
      undefined,
    )
    // and a factor above 0 means fits(0) failed, so a name really went
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

  // A grown stack (scale > 1) and a float-epsilon squeeze both round to 100
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

  // The row already names the setting, so the hint says only what of it is
  // not reaching the canvas — "hidden to fit" once none of it is.
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

  // Subfeature labels are their own radio, so their drop never leaks into the
  // Labels radio's hint — with nothing of the Labels row hidden there is no
  // hint at all at the bare rung.
  it('leaves the subfeature-label drop to the track-sizing note', () => {
    expect(labelsFitHint(drops(stage('bare'), false, false))).toBeUndefined()
  })
})
