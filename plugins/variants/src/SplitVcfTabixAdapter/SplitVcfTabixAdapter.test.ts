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

const region = { refName: 'ctgA', start: 0, end: 20000 }

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
