import { pairSyntenyTrackIds, stackSyntenyTrackIds } from './syntenyTracks.ts'

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

describe('stackSyntenyTrackIds', () => {
  test('lists each comparison between adjacent assemblies', () => {
    expect(stackSyntenyTrackIds(threeWay)).toEqual(['hg38_hs1', 'hs1_mm39'])
  })

  // A config holding every pairwise alignment is the ordinary way to get one of
  // these. The view would report it as covering no band and fail the render.
  test('a track naming a non-adjacent pair is skipped with a warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const data: Config = {
      ...threeWay,
      tracks: [...threeWay.tracks, synteny('hg38_mm39', ['hg38', 'mm39'])],
    }
    expect(stackSyntenyTrackIds(data)).toEqual(['hg38_hs1', 'hs1_mm39'])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('skipping synteny track "hg38_mm39"'),
    )
    warn.mockRestore()
  })

  test('a track with no assemblyNames is skipped with a warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const data: Config = { ...threeWay, tracks: [synteny('unlabeled', [])] }
    expect(stackSyntenyTrackIds(data)).toEqual([])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('skipping synteny track "unlabeled"'),
    )
    warn.mockRestore()
  })

  test('a track covering every assembly is listed once', () => {
    const data: Config = {
      ...threeWay,
      tracks: [synteny('all_vs_all', ['hg38', 'hs1', 'mm39'])],
    }
    expect(stackSyntenyTrackIds(data)).toEqual(['all_vs_all'])
  })

  test('a self pair needs a track naming the assembly twice', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const data: Config = {
      assemblies: [asm('wheat')],
      assembly: asm('wheat'),
      comparativeRows: [{ assembly: 'wheat' }, { assembly: 'wheat' }],
      tracks: [
        synteny('wheat_sorghum', ['wheat', 'sorghum']),
        synteny('wheat_self', ['wheat', 'wheat']),
      ],
    }
    expect(stackSyntenyTrackIds(data)).toEqual(['wheat_self'])
    warn.mockRestore()
  })
})
