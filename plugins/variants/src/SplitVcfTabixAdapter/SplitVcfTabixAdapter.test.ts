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

// `vcfGzLocationMap` is a frozen slot, so nothing validates its keys at load.
// The usual mistake is keying it in the other refName convention from the
// assembly, and both paths below used to surface that as a bare
// "Cannot read properties of undefined (reading 'uri')" naming neither the
// contig nor the slot.
test('a contig missing from the location map names itself and the alternatives', async () => {
  await expect(
    firstValueFrom(
      makeAdapter()
        .getFeatures({ ...region, refName: 'chrA' })
        .pipe(toArray()),
    ),
  ).rejects.toThrow(/no vcfGzLocationMap entry for "chrA".*ctgA/s)
})

test('an empty location map is reported rather than read as undefined', async () => {
  const adapter = new Adapter(
    configSchema.create({ vcfGzLocationMap: {}, indexType: 'TBI' }),
  )
  await expect(adapter.getSources()).rejects.toThrow(/empty vcfGzLocationMap/)
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
