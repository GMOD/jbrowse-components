import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './SplitVcfTabixAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter() {
  return new Adapter(
    configSchema.create({
      vcfGzLocationMap: {
        ctgA: {
          localPath:
            require.resolve('../VcfTabixAdapter/test_data/volvox.filtered.vcf.gz'),
          locationType: 'LocalPathLocation',
        },
      },
      // localPath configs can't auto-resolve the index (that fallback keys off
      // the uri), so point at it explicitly
      indexLocationMap: {
        ctgA: {
          localPath:
            require.resolve('../VcfTabixAdapter/test_data/volvox.filtered.vcf.gz.tbi'),
          locationType: 'LocalPathLocation',
        },
      },
      indexType: 'TBI',
    }),
  )
}

const region = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 20000,
}

test('getRefNames returns the location map keys', async () => {
  expect(await makeAdapter().getRefNames()).toEqual(['ctgA'])
})

test('fetches features from the per-ref file', async () => {
  const feats = await firstValueFrom(
    makeAdapter().getFeatures(region).pipe(toArray()),
  )
  expect(feats.length).toBeGreaterThan(0)
  expect(feats.map(f => f.get('refName')).every(r => r === 'ctgA')).toBe(true)
})

// tabix offsets are per file, and per-contig files with one header put
// every contig's first record at one offset
test('a feature id names its contig', async () => {
  const adapter = makeAdapter()
  const [first] = await firstValueFrom(
    adapter.getFeatures(region).pipe(toArray()),
  )
  expect(first!.id()).toMatch(new RegExp(`^${adapter.id}-ctgA-vcf-`))
})

test('getRegionByteSize returns a positive index estimate', async () => {
  const bytes = await makeAdapter().getRegionByteSize([region])
  expect(bytes).toBeGreaterThan(0)
})

test('getExportData round-trips header plus overlapping variant lines', async () => {
  const adapter = makeAdapter()
  const exported = await adapter.getExportData([region], 'vcf')
  const lines = exported!.split('\n')
  expect(lines.some(l => l.startsWith('##fileformat'))).toBe(true)

  const dataLines = lines.filter(l => l && !l.startsWith('#'))
  const feats = await firstValueFrom(
    adapter.getFeatures(region).pipe(toArray()),
  )
  expect(dataLines.length).toBe(feats.length)

  // non-vcf formats aren't supported
  expect(await adapter.getExportData([region], 'gff3')).toBeUndefined()
})

// a chr1-22 split set has no file for chrX, which is no variants there
test('a contig missing from the location map has no features', async () => {
  const adapter = makeAdapter()
  const missing = { ...region, refName: 'chrA' }
  expect(
    await firstValueFrom(adapter.getFeatures(missing).pipe(toArray())),
  ).toEqual([])
  expect(await adapter.getRegionByteSize([missing])).toBe(0)
  const exported = await adapter.getExportData([missing], 'vcf')
  expect(exported!.split('\n').every(l => l.startsWith('#'))).toBe(true)
})

test('the header answers getHeader and getMetadata', async () => {
  const adapter = makeAdapter()
  expect(await adapter.getHeader()).toMatch(/^##fileformat/)
  expect(await adapter.getMetadata()).toHaveProperty('INFO')
})

test('a derived index resolves against the config like its vcf', async () => {
  const requested: string[] = []
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async input => {
      requested.push(`${input}`)
      throw new Error('offline')
    })
  const adapter = new Adapter(
    configSchema.create({
      vcfGzLocationMap: {
        ctgA: {
          uri: 'ctgA.vcf.gz',
          baseUri: 'https://example.com/data/c.json',
        },
      },
    }),
  )
  await expect(
    firstValueFrom(adapter.getFeatures(region).pipe(toArray())),
  ).rejects.toThrow()
  fetchSpy.mockRestore()
  expect(requested).toContain('https://example.com/data/ctgA.vcf.gz.tbi')
})

// the slot answers only for the indexes this adapter derives
test('a named .tbi is read as a TBI whatever the indexType slot says', async () => {
  const vcfGz =
    require.resolve('../VcfTabixAdapter/test_data/volvox.filtered.vcf.gz')
  const adapter = new Adapter(
    configSchema.create({
      vcfGzLocationMap: {
        ctgA: { localPath: vcfGz, locationType: 'LocalPathLocation' },
      },
      indexLocationMap: {
        ctgA: { localPath: `${vcfGz}.tbi`, locationType: 'LocalPathLocation' },
      },
      indexType: 'CSI',
    }),
  )
  const features = await firstValueFrom(
    adapter.getFeatures(region).pipe(toArray()),
  )
  expect(features.length).toBeGreaterThan(0)
})

test('an empty location map is reported rather than read as undefined', async () => {
  const adapter = new Adapter(
    configSchema.create({ vcfGzLocationMap: {}, indexType: 'TBI' }),
  )
  await expect(adapter.getSources([])).rejects.toThrow(/empty vcfGzLocationMap/)
})

// The `.tbi` sibling is derived by appending to the uri, so a localPath/blob
// entry with no indexLocationMap of its own used to build the literal string
// "undefined.tbi" and fail inside tabix, naming a path nobody wrote. (This is
// why makeAdapter above points at its index explicitly.)
test('a non-uri entry with no configured index says so instead of fetching "undefined.tbi"', async () => {
  const adapter = new Adapter(
    configSchema.create({
      vcfGzLocationMap: {
        ctgA: {
          localPath:
            require.resolve('../VcfTabixAdapter/test_data/volvox.filtered.vcf.gz'),
          locationType: 'LocalPathLocation',
        },
      },
      indexType: 'TBI',
    }),
  )
  await expect(
    firstValueFrom(adapter.getFeatures(region).pipe(toArray())),
  ).rejects.toThrow(/needs an indexLocationMap entry for "ctgA"/)
})

// A named index says which kind it is by its extension, so the slot only has to
// answer for the ones this adapter derives. Reading a named `.csi` as the slot's
// TBI opened it with the wrong parser, and one map could not mix the two at all.
test('a named .csi is read as a CSI whatever the indexType slot says', async () => {
  const vcfGz =
    require.resolve('../VcfTabixAdapter/test_data/volvox.filtered.vcf.gz')
  const adapter = new Adapter(
    configSchema.create({
      vcfGzLocationMap: {
        ctgA: { localPath: vcfGz, locationType: 'LocalPathLocation' },
      },
      indexLocationMap: {
        ctgA: { localPath: `${vcfGz}.csi`, locationType: 'LocalPathLocation' },
      },
      indexType: 'TBI',
    }),
  )
  const features = await firstValueFrom(
    adapter.getFeatures(region).pipe(toArray()),
  )
  expect(features.length).toBeGreaterThan(0)
})

test('a record spanning two exported regions is exported once', async () => {
  const adapter = makeAdapter()
  const once = await adapter.getExportData([region], 'vcf')
  const twice = await adapter.getExportData([region, region], 'vcf')
  expect(twice).toBe(once)
})
