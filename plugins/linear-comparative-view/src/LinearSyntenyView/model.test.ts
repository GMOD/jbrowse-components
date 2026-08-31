import type { LinearSyntenyViewInit } from './types.ts'

describe('LinearSyntenyViewInit type', () => {
  test('init type accepts views with assembly', () => {
    const init: LinearSyntenyViewInit = {
      views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
    }
    expect(init.views!.length).toBe(2)
    expect(init.views![0]?.assembly).toBe('hg38')
  })

  test('init type accepts views with loc and assembly', () => {
    const init: LinearSyntenyViewInit = {
      views: [
        { loc: 'chr1:1-1000', assembly: 'hg38' },
        { loc: 'chr1:1-1000', assembly: 'mm39' },
      ],
    }
    expect(init.views![0]?.loc).toBe('chr1:1-1000')
  })

  test('init type accepts views with tracks', () => {
    const init: LinearSyntenyViewInit = {
      views: [
        { assembly: 'hg38', tracks: ['genes', 'repeats'] },
        { assembly: 'mm39' },
      ],
    }
    expect(init.views![0]?.tracks).toEqual(['genes', 'repeats'])
  })

  test('init type accepts flat string[] shorthand for level-0 tracks', () => {
    const init: LinearSyntenyViewInit = {
      views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
      tracks: ['hg38_vs_mm39_synteny'],
    }
    expect(init.tracks).toEqual(['hg38_vs_mm39_synteny'])
  })

  test('init type accepts synteny tracks at top level (per-level)', () => {
    const init: LinearSyntenyViewInit = {
      views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
      tracks: [['hg38_vs_mm39_synteny']],
    }
    expect(init.tracks).toEqual([['hg38_vs_mm39_synteny']])
  })

  test('init type accepts per-level tracks for multi-way', () => {
    const init: LinearSyntenyViewInit = {
      views: [{ assembly: 'hg38' }, { assembly: 'mm39' }, { assembly: 'rn7' }],
      tracks: [['hg38_vs_mm39'], ['mm39_vs_rn7']],
    }
    expect(init.tracks?.length).toBe(2)
    expect(init.tracks?.[0]).toEqual(['hg38_vs_mm39'])
    expect(init.tracks?.[1]).toEqual(['mm39_vs_rn7'])
  })

  test('init type accepts per-level synteny tracks (2D array)', () => {
    const init: LinearSyntenyViewInit = {
      views: [
        { assembly: 'grape' },
        { assembly: 'peach' },
        { assembly: 'cacao' },
      ],
      tracks: [['synteny_track_1', 'synteny_track_2']],
    }
    expect(init.views!.length).toBe(3)
    expect(init.tracks?.[0]?.length).toBe(2)
  })

  test('init type accepts fadeThinAlignmentsMode', () => {
    const init: LinearSyntenyViewInit = {
      views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
      fadeThinAlignmentsMode: 'auto',
    }
    expect(init.fadeThinAlignmentsMode).toBe('auto')
  })

  // The settings half of the type is derived from the state model, so a
  // property is typed here from the line that declares it — with the property's
  // own type, not `unknown`. Nothing in the init types names any of these.
  test('accepts any declared view property, in the property own type', () => {
    const init: LinearSyntenyViewInit = {
      views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
      drawLocationMarkers: true,
      opacityByIdentity: true,
      overdrawPx: 500,
      cigarMode: 'matches',
      lodMode: 'coarse',
      alpha: 0.4,
    }
    expect(init.cigarMode).toBe('matches')
  })

  test('rejects a misspelled property and a wrong value type', () => {
    // @ts-expect-error drawCurvez is not a property of the view
    const typo: LinearSyntenyViewInit = { views: [], drawCurvez: true }
    // @ts-expect-error alpha is a number
    const wrongType: LinearSyntenyViewInit = { views: [], alpha: 'loud' }
    expect([typo, wrongType]).toHaveLength(2)
  })

  test('rejects an enumeration value outside the property own union', () => {
    // @ts-expect-error cigarMode is 'off' | 'matches' | 'full'
    const bad: LinearSyntenyViewInit = { views: [], cigarMode: 'colored' }
    expect(bad).toBeTruthy()
  })
})
