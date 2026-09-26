import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Gff3Adapter from './Gff3Adapter.ts'
import configSchema from './configSchema.ts'

describe('adapter can fetch features from volvox.gff3', () => {
  let adapter: Gff3Adapter
  beforeEach(() => {
    adapter = new Gff3Adapter(
      configSchema.create({
        gffLocation: {
          localPath: require.resolve('../test_data/volvox.sort.gff3'),
        },
      }),
    )
  })
  it('test getfeatures on gff plain text adapter', async () => {
    const features = adapter.getFeatures({
      refName: 'ctgB',
      start: 0,
      end: 200000,
    })
    expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
    expect(await adapter.hasDataForRefName('ctgB')).toBe(true)
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    // There are only 4 features in ctgB
    expect(featuresArray.length).toBe(4)
    const featuresJsonArray = featuresArray.map(f => f.toJSON())
    expect(featuresJsonArray).toMatchSnapshot()
  })
})

describe('discontinuous feature parsing', () => {
  it('keeps every segment of a CDS that shares one ID across lines', async () => {
    const adapter = new Gff3Adapter(
      configSchema.create({
        gffLocation: {
          localPath: require.resolve('../test_data/disjoint_cds.gff3'),
        },
      }),
    )
    const features = adapter.getFeatures({
      refName: 'ctgA',
      start: 0,
      end: 1000,
    })
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    const gene = featuresArray[0]!.toJSON()
    const mrna = gene.subfeatures![0]!
    const cds = mrna.subfeatures!.filter(f => f.type === 'CDS')
    expect(cds.length).toBe(3)
    expect(cds.map(f => f.start)).toEqual([0, 199, 399])
  })
})

describe('top-level discontinuous features', () => {
  it('folds a cDNA_match into one feature with a block per line', async () => {
    const adapter = new Gff3Adapter(
      configSchema.create({
        gffLocation: {
          localPath: require.resolve('../test_data/cdna_match.gff3'),
        },
      }),
    )
    const features = adapter.getFeatures({
      refName: 'ctgA',
      start: 0,
      end: 10000,
    })
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    expect(featuresArray.map(f => f.get('type'))).toEqual([
      'gene',
      'cDNA_match',
      'match',
    ])
    const aln = featuresArray[1]!.toJSON()
    expect([aln.start, aln.end]).toEqual([999, 5000])
    expect(aln.subfeatures!.map(f => [f.type, f.start, f.end])).toEqual([
      ['cDNA_match', 999, 1200],
      ['cDNA_match', 1999, 2300],
      ['cDNA_match', 4499, 5000],
    ])
    expect(featuresArray[2]!.toJSON().subfeatures).toEqual([])
  })
})
