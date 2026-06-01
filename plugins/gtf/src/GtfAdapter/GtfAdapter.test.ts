import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import GtfAdapter from './GtfAdapter.ts'
import configSchema from './configSchema.ts'

describe('GtfAdapter on a GENCODE excerpt', () => {
  it('aggregates a gene from its transcript and exon/CDS lines', async () => {
    const adapter = new GtfAdapter(
      configSchema.create({
        gtfLocation: {
          localPath: require.resolve('../test_data/gencode_tp53.gtf'),
        },
      }),
    )
    expect(await adapter.hasDataForRefName('chr17')).toBe(true)
    const features = adapter.getFeatures({
      refName: 'chr17',
      start: 7571719,
      end: 7590868,
      assemblyName: 'hg19',
    })
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    const gene = featuresArray[0]!.toJSON()
    expect(gene.type).toBe('gene')
    expect(gene.name).toBe('TP53')
    const transcript = gene.subfeatures![0]!
    expect(transcript.type).toBe('transcript')
    expect(transcript.subfeatures!.filter(f => f.type === 'CDS')).toHaveLength(
      5,
    )
    expect(transcript.subfeatures!.filter(f => f.type === 'exon')).toHaveLength(
      5,
    )
    expect(featuresArray.map(f => f.toJSON())).toMatchSnapshot()
  })
})

test('can instantiate new GtfAdapter and check for demo data', async () => {
  const demoAdapter = new GtfAdapter(
    configSchema.create({
      gtfLocation: {
        localPath: require.resolve('../test_data/demo.gtf'),
      },
    }),
  )
  expect(await demoAdapter.hasDataForRefName('GeneScaffold_1')).toBe(true)
  expect(await demoAdapter.hasDataForRefName('GeneScaffold_10')).toBe(true)
  expect(await demoAdapter.hasDataForRefName('GeneScaffold_11')).toBe(false)

  const features = demoAdapter.getFeatures({
    refName: 'GeneScaffold_1',
    start: 0,
    end: 1100000,
    assemblyName: 'volvox',
  })
  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  // ENSVPAT00000000407
  expect(featuresArray.length).toEqual(1)
  expect(featuresJsonArray).toMatchSnapshot()
})
