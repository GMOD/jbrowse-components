import { pairSyntenyTrackIds, syntenyTrackLevels } from './syntenyTracks.ts'

import type { Assembly, Config, Track } from './types.ts'

const asm = (name: string): Assembly => ({ name, sequence: {} })

const synteny = (trackId: string, assemblyNames: string[]): Track => ({
  type: 'SyntenyTrack',
  trackId,
  assemblyNames,
})

// hg38 / hs1 / mm39 stacked, with a comparison in each gap. The hs1-mm39 track
// deliberately lists its assemblies in the reverse of the stacking order, the
// way a chain file's [query, target] does.
const threeWay: Config = {
  assemblies: [asm('hg38'), asm('hs1'), asm('mm39')],
  assembly: asm('hg38'),
  tracks: [
    synteny('hg38_hs1', ['hg38', 'hs1']),
    synteny('hs1_mm39', ['mm39', 'hs1']),
    { type: 'FeatureTrack', trackId: 'genes', assemblyNames: ['hg38'] },
  ],
}

describe('pairSyntenyTrackIds', () => {
  test('only the comparisons between the requested pair', () => {
    expect(pairSyntenyTrackIds(threeWay, 'hg38', 'hs1')).toEqual(['hg38_hs1'])
    expect(pairSyntenyTrackIds(threeWay, 'hs1', 'mm39')).toEqual(['hs1_mm39'])
  })

  // A dotplot of the first two assemblies must not open the hs1-mm39 track: it
  // fetches that (often remote) alignment only to log "hg38 not found in this
  // adapter" for every block.
  test('a pair with no comparison between it gets no tracks', () => {
    expect(pairSyntenyTrackIds(threeWay, 'hg38', 'mm39')).toEqual([])
  })

  test('non-synteny tracks are never included', () => {
    expect(pairSyntenyTrackIds(threeWay, 'hg38', 'hs1')).not.toContain('genes')
  })

  test('a synteny track with no assemblyNames matches no pair', () => {
    const data: Config = {
      ...threeWay,
      tracks: [synteny('unlabeled', [])],
    }
    expect(pairSyntenyTrackIds(data, 'hg38', 'hs1')).toEqual([])
  })
})

describe('syntenyTrackLevels', () => {
  test('each track lands in the gap between the pair it compares', () => {
    expect(syntenyTrackLevels(threeWay)).toEqual([['hg38_hs1'], ['hs1_mm39']])
  })

  test('one level per gap, empty when a gap has no comparison', () => {
    const data: Config = {
      ...threeWay,
      tracks: [synteny('hs1_mm39', ['mm39', 'hs1'])],
    }
    expect(syntenyTrackLevels(data)).toEqual([[], ['hs1_mm39']])
  })

  // Unlike the dotplot, synteny keeps a track it has no way to place rather than
  // dropping it — a two-assembly view has one gap and it can only mean that one.
  test('a track with no assemblyNames falls back to level 0', () => {
    const data: Config = {
      ...threeWay,
      tracks: [synteny('unlabeled', [])],
    }
    expect(syntenyTrackLevels(data)).toEqual([['unlabeled'], []])
  })

  // A config holding every pairwise alignment is the ordinary way to get one of
  // these. Level 0 would draw hg38-vs-mm39 between hg38 and hs1, mapping
  // coordinates through an assembly the adapter knows nothing about.
  test('a track naming a non-adjacent pair is skipped, not put on level 0', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const data: Config = {
      ...threeWay,
      tracks: [...threeWay.tracks, synteny('hg38_mm39', ['hg38', 'mm39'])],
    }
    expect(syntenyTrackLevels(data)).toEqual([['hg38_hs1'], ['hs1_mm39']])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('skipping synteny track "hg38_mm39"'),
    )
    warn.mockRestore()
  })

  // One AllVsAllPAFAdapter / MCScanBlocksAdapter track lists every assembly its
  // file covers and backs every band of the stack — each level hands it that
  // level's pair. This is what the multiway and all-vs-all synteny tutorials
  // build, and matching only the first level left every band below the top one
  // empty.
  test('a track covering every assembly backs every level', () => {
    const data: Config = {
      ...threeWay,
      tracks: [synteny('all_vs_all', ['hg38', 'hs1', 'mm39'])],
    }
    expect(syntenyTrackLevels(data)).toEqual([['all_vs_all'], ['all_vs_all']])
  })

  test('a multi-assembly track sits alongside the pairwise ones it overlaps', () => {
    const data: Config = {
      ...threeWay,
      tracks: [...threeWay.tracks, synteny('all', ['hg38', 'hs1', 'mm39'])],
    }
    expect(syntenyTrackLevels(data)).toEqual([
      ['hg38_hs1', 'all'],
      ['hs1_mm39', 'all'],
    ])
  })

  // A track that covers only some adjacent pairs lands on just those
  test('a partial multi-assembly track only backs the pairs it covers', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const data: Config = {
      ...threeWay,
      tracks: [synteny('hg38_hs1_only', ['hg38', 'hs1'])],
    }
    expect(syntenyTrackLevels(data)).toEqual([['hg38_hs1_only'], []])
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
