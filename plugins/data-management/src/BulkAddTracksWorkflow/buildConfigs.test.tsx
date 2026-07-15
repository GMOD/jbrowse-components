import { buildTrackConfigs } from './buildConfigs.ts'
import { pairLocations } from './pairLocations.ts'
import { makeModel, uri } from './testUtils.tsx'

import type { FileLocation } from '@jbrowse/core/util/types'

function build(locations: FileLocation[]) {
  return buildTrackConfigs({
    pairs: pairLocations(locations),
    model: makeModel(),
    assembly: 'volvox',
    timestamp: 123,
  })
}

test('detects bam alignments track and pairs its index', () => {
  const rows = build([uri('/a.bam'), uri('/a.bam.bai')])
  expect(rows).toHaveLength(1)
  expect(rows[0]!.adapterType).toBe('BamAdapter')
  expect(rows[0]!.trackType).toBe('AlignmentsTrack')
  expect(rows[0]!.indexName).toBe('a.bam.bai')
  expect(rows[0]!.status).toBe('ok')
  expect(rows[0]!.conf.assemblyNames).toEqual(['volvox'])
})

test('detects bgzipped vcf variant track', () => {
  const rows = build([uri('/v.vcf.gz'), uri('/v.vcf.gz.tbi')])
  expect(rows[0]!.adapterType).toBe('VcfTabixAdapter')
  expect(rows[0]!.trackType).toBe('VariantTrack')
})

test('flags an unrecognized extension as unknown', () => {
  const rows = build([uri('/mystery.qqq')])
  expect(rows[0]!.status).toBe('unknown')
})
