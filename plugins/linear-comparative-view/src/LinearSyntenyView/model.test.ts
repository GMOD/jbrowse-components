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

  test('init type accepts flat synteny tracks (backwards compat)', () => {
    const init: LinearSyntenyViewInit = {
      views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
      tracks: ['hg38_vs_mm39_synteny'],
    }
    expect(init.tracks).toEqual(['hg38_vs_mm39_synteny'])
  })

  test('init type accepts per-level synteny tracks (2D array)', () => {
    const init: LinearSyntenyViewInit = {
      views: [
        { assembly: 'grape' },
        { assembly: 'peach' },
        { assembly: 'cacao' },
      ],
      tracks: [['grape_vs_peach'], ['peach_vs_cacao']],
    }
    expect(init.tracks).toEqual([['grape_vs_peach'], ['peach_vs_cacao']])
    expect((init.tracks as string[][])[0]).toEqual(['grape_vs_peach'])
    expect((init.tracks as string[][])[1]).toEqual(['peach_vs_cacao'])
  })

  test('per-level tracks can have multiple tracks per level', () => {
    const init: LinearSyntenyViewInit = {
      views: [{ assembly: 'volvox-ins' }, { assembly: 'volvox' }],
      tracks: [['volvox_ins.paf', 'volvox_del.paf']],
    }
    expect((init.tracks as string[][])[0]).toEqual([
      'volvox_ins.paf',
      'volvox_del.paf',
    ])
  })

  test('3-way with multiple tracks per level', () => {
    const init: LinearSyntenyViewInit = {
      views: [
        { assembly: 'volvox-ins' },
        { assembly: 'volvox' },
        { assembly: 'volvox-del' },
      ],
      tracks: [['volvox_ins.paf'], ['volvox_del.paf']],
    }
    expect(init.views.length).toBe(3)
    expect((init.tracks as string[][]).length).toBe(2)
  })
})
