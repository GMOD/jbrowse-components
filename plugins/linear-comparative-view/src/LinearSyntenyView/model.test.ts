import type { LinearSyntenyViewInit } from './types.ts'

describe('LinearSyntenyViewInit type', () => {
  test('init type accepts views with assembly', () => {
    const init: LinearSyntenyViewInit = {
      views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
    }
    expect(init.views.length).toBe(2)
    expect(init.views[0]?.assembly).toBe('hg38')
  })

  test('init type accepts views with loc and assembly', () => {
    const init: LinearSyntenyViewInit = {
      views: [
        { loc: 'chr1:1-1000', assembly: 'hg38' },
        { loc: 'chr1:1-1000', assembly: 'mm39' },
      ],
    }
    expect(init.views[0]?.loc).toBe('chr1:1-1000')
  })

  test('init type accepts views with tracks', () => {
    const init: LinearSyntenyViewInit = {
      views: [
        { assembly: 'hg38', tracks: ['genes', 'repeats'] },
        { assembly: 'mm39' },
      ],
    }
    expect(init.views[0]?.tracks).toEqual(['genes', 'repeats'])
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
    expect(init.views.length).toBe(2)
    expect(init.tracks?.[0]?.length).toBe(2)
  })
})
