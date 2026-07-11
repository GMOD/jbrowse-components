import { statusMessageText } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Gff3TabixAdapter from './Gff3TabixAdapter.ts'
import configSchema from './configSchema.ts'

describe('adapter can fetch features from volvox.gff3', () => {
  let adapter: Gff3TabixAdapter
  beforeEach(() => {
    adapter = new Gff3TabixAdapter(
      configSchema.create({
        gffGzLocation: {
          localPath: require.resolve('../test_data/volvox.sort.gff3.gz'),
        },
        index: {
          location: {
            localPath: require.resolve('../test_data/volvox.sort.gff3.gz.tbi'),
          },
        },
      }),
    )
  })
  it('test getfeatures on gff plain text adapter', async () => {
    const features = adapter.getFeatures({
      refName: 'ctgB',
      start: 0,
      end: 200000,
      assemblyName: 'volvox',
    })
    expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
    expect(await adapter.hasDataForRefName('ctgB')).toBe(true)
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    // There are only 4 features in ctgB
    expect(featuresArray.length).toBe(4)
    const featuresJsonArray = featuresArray.map(f => f.toJSON())
    expect(featuresJsonArray).toMatchSnapshot()
  })

  // Regression: a second fetch (e.g. after a small pan/zoom) reuses the cached
  // index and must not re-flash "Downloading index" — it only downloads features
  it('emits "Downloading index" on first fetch only, not once cached', async () => {
    const query = {
      refName: 'ctgB',
      start: 0,
      end: 200000,
      assemblyName: 'volvox',
    }
    const collect = async () => {
      const seen: string[] = []
      await firstValueFrom(
        adapter
          .getFeatures(query, {
            statusCallback: s => {
              seen.push(statusMessageText(s) ?? '')
            },
          })
          .pipe(toArray()),
      )
      return seen
    }

    const first = await collect()
    const second = await collect()

    expect(first).toContain('Downloading index')
    expect(second).not.toContain('Downloading index')
    // features are still downloaded on every fetch
    expect(second).toContain('Downloading features')
  })
})

describe('redispatch when features extend beyond the query', () => {
  it('assembles a full gene when the query lands inside it', async () => {
    const adapter = new Gff3TabixAdapter(
      configSchema.create({
        gffGzLocation: {
          localPath: require.resolve('../test_data/volvox.sort.gff3.gz'),
        },
        index: {
          location: {
            localPath: require.resolve('../test_data/volvox.sort.gff3.gz.tbi'),
          },
        },
      }),
    )
    // a narrow window near the 3' end of the EDEN gene (ctgA:1050-9000); its 5'
    // CDS segments fall outside the window and are only recovered because the
    // spanning gene line triggers a single redispatch to the gene's full bounds
    const features = adapter.getFeatures({
      refName: 'ctgA',
      start: 7000,
      end: 7100,
      assemblyName: 'volvox',
    })
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    const eden = featuresArray.map(f => f.toJSON()).find(f => f.name === 'EDEN')
    expect(eden).toBeDefined()
    const mrna1 = eden!.subfeatures!.find(f => f.name === 'EDEN.1')!
    const cdsStarts = mrna1.subfeatures!
      .filter(f => f.type === 'CDS')
      .map(f => f.start)
    // includes the 5' CDS at interbase 1200, far outside the [7000, 7100] query
    expect(Math.min(...cdsStarts)).toBeLessThan(7000)
    expect(cdsStarts).toContain(1200)
  })
})

describe('discontinuous feature parsing', () => {
  it('keeps every segment of a CDS that shares one ID across lines', async () => {
    const adapter = new Gff3TabixAdapter(
      configSchema.create({
        gffGzLocation: {
          localPath: require.resolve('../test_data/disjoint_cds.gff3.gz'),
        },
        index: {
          location: {
            localPath: require.resolve('../test_data/disjoint_cds.gff3.gz.tbi'),
          },
        },
      }),
    )
    const features = adapter.getFeatures({
      refName: 'ctgA',
      start: 0,
      end: 1000,
      assemblyName: 'volvox',
    })
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    const gene = featuresArray[0]!.toJSON()
    const mrna = gene.subfeatures![0]!
    const cds = mrna.subfeatures!.filter(f => f.type === 'CDS')
    expect(cds.length).toBe(3)
    expect(cds.map(f => f.start)).toEqual([0, 199, 399])
  })
})
