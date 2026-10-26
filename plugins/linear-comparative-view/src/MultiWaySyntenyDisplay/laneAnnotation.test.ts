import { annotationRank, laneGeneTracksOf } from './laneAnnotation.ts'

import type { AnyTrackConfig } from '@jbrowse/core/configuration'

test('a lane takes its annotation from more than GFF3', () => {
  expect(annotationRank('Gff3TabixAdapter')).toBe(0)
  expect(annotationRank('GtfTabixAdapter')).toBe(1)
  expect(annotationRank('BigBedAdapter')).toBe(2)
  expect(annotationRank('NCListAdapter')).toBe(3)
})

test('a track that is not annotation at all is no lane’s annotation', () => {
  for (const type of [
    'BamAdapter',
    'CramAdapter',
    'VcfTabixAdapter',
    'BigWigAdapter',
    'IndexedFastaAdapter',
    'MCScanBlocksAdapter',
    undefined,
  ]) {
    expect(annotationRank(type)).toBeUndefined()
  }
})

test('genes outrank repeats when one assembly declares both', () => {
  expect(annotationRank('Gff3TabixAdapter')).toBeLessThan(
    annotationRank('BedTabixAdapter')!,
  )
  expect(annotationRank('GtfAdapter')).toBeLessThan(
    annotationRank('BedAdapter')!,
  )
})

describe('laneGeneTracksOf', () => {
  const track = (trackId: string, assemblyNames: string[], type: string) =>
    ({
      trackId,
      assemblyNames,
      adapter: { type },
    }) as unknown as AnyTrackConfig
  const keyOf = (name: string) => name.toLowerCase()
  const run = (
    tracks: AnyTrackConfig[],
    named: Record<string, AnyTrackConfig[]> = {},
  ) =>
    laneGeneTracksOf({
      lanes: ['A', 'b'],
      keyOf,
      tracks,
      namedTracks: key => named[key] ?? [],
    })

  test('a lane takes the best-ranked annotation track of its assembly', () => {
    const bed = track('bed', ['a'], 'BedTabixAdapter')
    const gff = track('gff', ['a'], 'Gff3TabixAdapter')
    expect(run([bed, gff]).get('A')).toBe(gff)
  })

  test('a track the config names wins over a better-ranked one', () => {
    const named = track('named', ['b'], 'BedAdapter')
    const gff = track('gff', ['b'], 'Gff3TabixAdapter')
    expect(run([gff], { b: [named] }).get('b')).toBe(named)
  })

  test('a BED track whose blocks are not genes is no lane’s gene track', () => {
    const regions = {
      trackId: 'regions',
      assemblyNames: ['a'],
      adapter: { type: 'BedTabixAdapter', disableGeneHeuristic: true },
    } as unknown as AnyTrackConfig
    const bigBed = track('bigbed', ['a'], 'BigBedAdapter')
    expect(run([regions]).size).toBe(0)
    expect(run([regions, bigBed]).get('A')).toBe(bigBed)
    expect(run([], { a: [regions] }).get('A')).toBe(regions)
  })

  test('a track that is not annotation, or spans assemblies, is nobody’s', () => {
    const bam = track('bam', ['a'], 'BamAdapter')
    const both = track('both', ['a', 'b'], 'Gff3TabixAdapter')
    expect(run([bam, both]).size).toBe(0)
  })

  test('lanes sharing one key share the track under their own spellings', () => {
    const gff = track('gff', ['a'], 'Gff3TabixAdapter')
    const out = laneGeneTracksOf({
      lanes: ['A', 'a'],
      keyOf,
      tracks: [gff],
      namedTracks: () => [],
    })
    expect([...out.keys()]).toEqual(['A', 'a'])
  })
})
