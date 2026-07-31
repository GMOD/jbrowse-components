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

  // Unlike the dotplot, synteny keeps an unplaceable track rather than dropping
  // it — a two-assembly view has one gap and it can only mean that one.
  test('a track matching no pair falls back to level 0', () => {
    const data: Config = {
      ...threeWay,
      tracks: [synteny('unlabeled', [])],
    }
    expect(syntenyTrackLevels(data)).toEqual([['unlabeled'], []])
  })
})
