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
  const region = { refName: 'ctgA', start: 2000, end: 3000 }
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
