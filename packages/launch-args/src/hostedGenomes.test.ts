import { hostedComparative } from './hostedGenomes.ts'

import type { Track } from './fileInput.ts'
import type { HostedConfig } from './hostedGenomes.ts'

// a genomes.jbrowse.org liftOver comparison, which its target's config holds
const liftOver = (target: string, query: string): Track => ({
  trackId: `${target}_to_${query}_liftOver`,
  type: 'SyntenyTrack',
  assemblyNames: [target, query],
})

const hosted = (name: string, tracks: Track[]): HostedConfig => ({
  assemblies: [{ name, sequence: {} }],
  tracks: [{ trackId: `${name}-genes`, type: 'FeatureTrack' }, ...tracks],
})

const configs = new Map([
  ['hg38', hosted('hg38', [liftOver('hg38', 'mm39'), liftOver('hg38', 'hs1')])],
  ['mm39', hosted('mm39', [liftOver('mm39', 'hg38')])],
  ['hs1', hosted('hs1', [])],
])

const rows = (...names: string[]) => names.map(assembly => ({ assembly }))

const ids = (tracks: Track[]) => tracks.map(t => t.trackId)

test("each gap takes one comparison, the upper row's config first", () => {
  expect(
    ids(hostedComparative(rows('hg38', 'mm39'), [], configs).tracks),
  ).toEqual(['hg38_to_mm39_liftOver'])
  expect(
    ids(hostedComparative(rows('mm39', 'hg38'), [], configs).tracks),
  ).toEqual(['mm39_to_hg38_liftOver'])
})

test('a gap the lower config covers alone takes its comparison', () => {
  expect(
    ids(hostedComparative(rows('hs1', 'hg38'), [], configs).tracks),
  ).toEqual(['hg38_to_hs1_liftOver'])
})

test('a pair twice in the stack takes one comparison for both gaps', () => {
  expect(
    ids(hostedComparative(rows('hg38', 'mm39', 'hg38'), [], configs).tracks),
  ).toEqual(['hg38_to_mm39_liftOver'])
})

test('a comparison file fills its gap, and file-only gaps are left alone', () => {
  const file: Track = {
    trackId: 'mine.paf',
    type: 'SyntenyTrack',
    assemblyNames: ['mm39', 'hg38'],
  }
  const { assemblies, tracks } = hostedComparative(
    rows('hg38', 'mm39', 'a.fa', 'b.fa'),
    [file, { ...file, trackId: 'mm39_a.paf', assemblyNames: ['mm39', 'a.fa'] }],
    new Map([
      ['hg38', configs.get('hg38')!],
      ['mm39', configs.get('mm39')!],
    ]),
  )
  expect(tracks).toEqual([])
  expect(assemblies.map(a => a.name)).toEqual(['hg38', 'mm39'])
})

test('a gap no config and no file covers throws', () => {
  expect(() => hostedComparative(rows('hg38', 'hg38'), [], configs)).toThrow(
    'genomes.jbrowse.org has no comparison between hg38 and hg38; put a comparison file between them',
  )
  expect(() => hostedComparative(rows('hg38', 'a.fa'), [], configs)).toThrow(
    /between hg38 and a\.fa/,
  )
})

test('a config without the assembly it was fetched for throws', () => {
  expect(() =>
    hostedComparative(
      rows('hg38', 'mm39'),
      [],
      new Map([['hg38', hosted('GRCh38', [liftOver('GRCh38', 'mm39')])]]),
    ),
  ).toThrow('--genome hg38: its hosted config names no assembly hg38')
})
