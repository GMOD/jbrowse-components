import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import GtfTabixAdapter from './GtfTabixAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter() {
  return new GtfTabixAdapter(
    configSchema.create({
      gtfGzLocation: {
        localPath: require.resolve('../test_data/demo.sorted.gtf.gz'),
      },
      index: {
        location: {
          localPath: require.resolve('../test_data/demo.sorted.gtf.gz.tbi'),
        },
      },
    }),
  )
}

test('reads ref names from the tabix index', async () => {
  const adapter = makeAdapter()
  expect(await adapter.hasDataForRefName('GeneScaffold_1')).toBe(true)
  expect(await adapter.hasDataForRefName('GeneScaffold_10')).toBe(true)
  expect(await adapter.hasDataForRefName('GeneScaffold_11')).toBe(false)
})

test('redispatches off the spanning transcript line to recover the whole gene', async () => {
  const adapter = makeAdapter()
  // this window lands in an intron: it overlaps only the spanning transcript
  // line, so completeness depends on redispatch pulling in every exon/CDS
  const features = adapter.getFeatures({
    refName: 'GeneScaffold_10',
    start: 40000,
    end: 40100,
    assemblyName: 'volvox',
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  const gene = featuresArray[0]!.toJSON()
  expect(gene.type).toBe('gene')
  expect(gene.name).toBe('RNPS1')

  const transcript = gene.subfeatures![0]!
  expect(transcript.type).toBe('transcript')
  const exons = transcript.subfeatures!.filter(f => f.type === 'exon')
  const cds = transcript.subfeatures!.filter(f => f.type === 'CDS')
  expect(exons.length).toBe(8)
  expect(cds.length).toBe(8)
})

test('getRegionByteSize returns a positive index-only estimate', async () => {
  const adapter = makeAdapter()
  const bytes = await adapter.getRegionByteSize([
    { refName: 'GeneScaffold_10', start: 0, end: 1_000_000, assemblyName: 'volvox' },
  ])
  expect(bytes).toBeGreaterThan(0)
})

test('mints stable feature ids across different query windows', async () => {
  const adapter = makeAdapter()
  const geneIdFor = async (start: number, end: number) => {
    const features = adapter.getFeatures({
      refName: 'GeneScaffold_10',
      start,
      end,
      assemblyName: 'volvox',
    })
    const arr = await firstValueFrom(features.pipe(toArray()))
    return arr[0]!.id()
  }
  // two different windows over the same gene must resolve to the same id (the
  // id is derived from the tabix byte offset, not the per-query parse index),
  // so a feature stays selected while panning
  expect(await geneIdFor(40000, 40100)).toBe(await geneIdFor(41000, 41100))
})
