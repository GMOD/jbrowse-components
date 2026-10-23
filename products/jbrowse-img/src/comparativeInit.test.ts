import {
  comparativeViews,
  dotplotInit,
  syntenyInit,
} from './comparativeInit.ts'

import type { Assembly, Config, Track } from './types.ts'

function asm(name: string): Assembly {
  return { name, sequence: { type: 'ReferenceSequenceTrack' } }
}

function syntenyTrack(trackId: string, assemblyNames: string[]): Track {
  return { trackId, type: 'SyntenyTrack', assemblyNames }
}

function config(assemblies: Assembly[], tracks: Track[] = []): Config {
  return { assemblies, assembly: assemblies[0]!, tracks }
}

describe('comparativeViews', () => {
  test('throws when fewer than two assemblies were supplied', () => {
    expect(() => comparativeViews(config([asm('a')]))).toThrow(
      /at least two assemblies/,
    )
  })

  test('stacks the assemblies whole when no rows were given', () => {
    expect(comparativeViews(config([asm('a'), asm('b')]))).toEqual([
      { assembly: 'a' },
      { assembly: 'b' },
    ])
  })

  test('takes the command line rows, one assembly twice for a self pair', () => {
    const rows = [{ assembly: 'a', loc: 'chr1' }, { assembly: 'a' }]
    const data = { ...config([asm('a')]), comparativeRows: rows }
    expect(comparativeViews(data)).toEqual(rows)
    expect(dotplotInit(data).views).toEqual(rows)
  })
})

describe('dotplotInit', () => {
  test('takes only the first two assemblies and the comparisons between them', () => {
    const data = config(
      [asm('a'), asm('b'), asm('c')],
      [syntenyTrack('a_b', ['a', 'b']), syntenyTrack('b_c', ['b', 'c'])],
    )
    expect(dotplotInit(data)).toEqual({
      views: [{ assembly: 'a' }, { assembly: 'b' }],
      tracks: ['a_b'],
    })
  })
})

describe('syntenyInit', () => {
  test('stacks every assembly and lists the comparisons the view places', () => {
    const data = config(
      [asm('a'), asm('b'), asm('c')],
      [syntenyTrack('a_b', ['a', 'b']), syntenyTrack('b_c', ['b', 'c'])],
    )
    expect(syntenyInit(data)).toEqual({
      views: [{ assembly: 'a' }, { assembly: 'b' }, { assembly: 'c' }],
      tracks: ['a_b', 'b_c'],
    })
  })
})
