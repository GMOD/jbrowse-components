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
    const cdsStarts = mrna1
      .subfeatures!.filter(f => f.type === 'CDS')
      .map(f => f.start)
    // includes the 5' CDS at interbase 1200, far outside the [7000, 7100] query
    expect(Math.min(...cdsStarts)).toBeLessThan(7000)
    expect(cdsStarts).toContain(1200)
  })

  // regression: the gene at [50,120] extends left out of the query and drives
  // the redispatch, but `region` is a dontRedispatch type and so contributes
  // nothing to the expanded bounds. Unless the refetch range is unioned with
  // the original query it lands on [50,120], which no longer covers the region
  // at [150,200] and silently drops it from the output
  it('keeps a dontRedispatch feature the expanded range would miss', async () => {
    const adapter = new Gff3TabixAdapter(
      configSchema.create({
        gffGzLocation: {
          localPath: require.resolve('../test_data/redispatch_region.gff3.gz'),
        },
        index: {
          location: {
            localPath:
              require.resolve('../test_data/redispatch_region.gff3.gz.tbi'),
          },
        },
      }),
    )
    const features = await firstValueFrom(
      adapter
        .getFeatures({
          refName: 'ctgA',
          start: 100,
          end: 200,
          assemblyName: 'volvox',
        })
        .pipe(toArray()),
    )
    expect(features.map(f => f.get('name')).sort()).toEqual([
      'gene1',
      'region1',
    ])
  })

  // Ensembl labels non-chromosomal sequences `supercontig`, and its record
  // spans the whole scaffold. Unless that type is in dontRedispatch, opening
  // any locus on the scaffold expands the refetch to all 100kb of it — one
  // extra "Downloading features" round trip that returns nothing new
  it('does not redispatch on an Ensembl supercontig record', async () => {
    const adapter = new Gff3TabixAdapter(
      configSchema.create({
        gffGzLocation: {
          localPath:
            require.resolve('../test_data/ensembl_supercontig.gff3.gz'),
        },
        index: {
          location: {
            localPath:
              require.resolve('../test_data/ensembl_supercontig.gff3.gz.tbi'),
          },
        },
      }),
    )
    const seen: string[] = []
    const features = await firstValueFrom(
      adapter
        .getFeatures(
          {
            refName: 'KI270728.1',
            start: 50000,
            end: 50100,
            assemblyName: 'hg38',
          },
          {
            statusCallback: s => {
              seen.push(statusMessageText(s) ?? '')
            },
          },
        )
        .pipe(toArray()),
    )
    expect(features.map(f => f.get('type')).sort()).toEqual([
      'gene',
      'supercontig',
    ])
    // a fetch writes the label once and then repeats it on every byte tick, so
    // count entries into the phase rather than raw occurrences
    const fetches = seen.filter(
      (s, i) => s === 'Downloading features' && seen[i - 1] !== s,
    )
    expect(fetches.length).toBe(1)
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
