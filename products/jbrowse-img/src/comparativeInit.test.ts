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

  test('keeps assembly order and attaches each per-assembly loc', () => {
    const data = { ...config([asm('a'), asm('b')]), assemblyLocs: ['chr1'] }
    expect(comparativeViews(data)).toEqual([
      { assembly: 'a', loc: 'chr1' },
      { assembly: 'b' },
    ])
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
