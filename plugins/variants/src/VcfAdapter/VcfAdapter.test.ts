import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './VcfAdapter.ts'
import configSchema from './configSchema.ts'

test('adapter can fetch variants from volvox.vcf', async () => {
  const adapter = new Adapter(
    configSchema.create({
      vcfLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const feat = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const names = await adapter.getRefNames()
  expect(names).toMatchSnapshot()

  const featArray = await firstValueFrom(feat.pipe(toArray()))
  expect(featArray.slice(0, 5)).toMatchSnapshot()
})

test('getExportData filters by [start,end] overlap, matching getFeatures', async () => {
  const adapter = new Adapter(
    configSchema.create({
      vcfLocation: {
        localPath: require.resolve('./test_data/overlap.vcf'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  // region falls entirely inside the del1 span (POS 1000, END 5000) but after
  // its POS; a POS-only filter would drop it, an overlap filter keeps it
  const region = {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 2000,
    end: 3000,
  }
  const exported = await adapter.getExportData([region], 'vcf')
  const ids = exported!
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('\t')[2])

  expect(ids).toEqual(['del1'])

  // getFeatures over the same region agrees: only the spanning deletion
  const feats = await firstValueFrom(
    adapter.getFeatures(region).pipe(toArray()),
  )
  expect(feats.map(f => f.get('name'))).toEqual(['del1'])
})

test('reads an in-memory VCF from a data: URI (consensus "open as track" path)', async () => {
  const vcf = [
    '##fileformat=VCFv4.3',
    '##contig=<ID=ctgA>',
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
    'ctgA\t100\t.\tA\tG\t.\t.\tDP=10;AF=0.900',
  ].join('\n')
  const adapter = new Adapter(
    configSchema.create({
      vcfLocation: {
        locationType: 'UriLocation',
        uri: `data:text/plain;base64,${Buffer.from(vcf).toString('base64')}`,
      },
    }),
  )

  const feats = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 0,
        end: 200,
      })
      .pipe(toArray()),
  )
  expect(feats.length).toBe(1)
  expect(feats[0]!.get('start')).toBe(99)
  expect(feats[0]!.get('ALT')).toEqual(['G'])
})

// `samplesTsvLocation` pointing at a metadata file that names none of the VCF's
// samples used to empty the sample list quietly: `getSources` returned [], so
// `sourcesBase` was [] — truthy, so no loading state — and the display drew an
// empty band with no banner while both mismatch warnings went to the worker's
// console. It reaches the caller as an error now, and the sources fetch's
// autorun turns that into `notifyError`.
function adapterWithSamplesTsv(tsv: string) {
  return new Adapter(
    configSchema.create({
      vcfLocation: {
        localPath: require.resolve('./test_data/volvox.filtered.vcf'),
        locationType: 'LocalPathLocation',
      },
      samplesTsvLocation: {
        localPath: require.resolve(tsv),
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

test('a samplesTsv naming no VCF sample fails the sources fetch', async () => {
  await expect(
    adapterWithSamplesTsv('./test_data/samples_prefixed.tsv').getSources(),
  ).rejects.toThrow(/matches the VCF header/)
})

test('the error names the metadata file and shows the mismatch', async () => {
  await expect(
    adapterWithSamplesTsv('./test_data/samples_prefixed.tsv').getSources(),
  ).rejects.toThrow(/samples_prefixed\.tsv.*"1000GP_sample_data/s)
})

// The base-class contract is unchanged — the warnings ride on the second method
// so that anything calling `getSources` still gets a plain array.
test('a matching samplesTsv still yields the metadata columns', async () => {
  const adapter = adapterWithSamplesTsv('./test_data/samples.tsv')

  expect(await adapter.getSources()).toEqual([
    {
      name: 'sample_data/raw/volvox/volvox-sorted.bam',
      population: 'GBR',
    },
  ])
  expect((await adapter.getSourcesAndWarnings()).warnings).toEqual([])
})
