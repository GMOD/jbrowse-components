import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './VcfTabixAdapter.ts'
import configSchema from './configSchema.ts'

const reads: { event: 'start' | 'end'; position: number }[] = []

jest.mock('@jbrowse/core/util/io', () => {
  const actual = jest.requireActual('@jbrowse/core/util/io')
  return {
    ...actual,
    openLocation: (location: unknown) => {
      const file = actual.openLocation(location)
      return {
        read: async (length: number, position: number, opts: unknown) => {
          reads.push({ event: 'start', position })
          await new Promise(resolve => setTimeout(resolve, 30))
          const buf = await file.read(length, position, opts)
          reads.push({ event: 'end', position })
          return buf
        },
        readFile: (opts: unknown) => file.readFile(opts),
        stat: () => file.stat(),
        close: () => file.close(),
      }
    },
  }
})

// The header read is sized from the index and the region read needs only the
// index, so a cold load issues both at once: one round trip, not two. The
// lines wait for the parser the header builds.
test('the first load reads the header beside the region', async () => {
  const file = '../../../../test_data/volvox/volvox.variants.vcf.gz'
  const adapter = new Adapter(
    configSchema.create({
      vcfGzLocation: {
        localPath: require.resolve(file),
        locationType: 'LocalPathLocation',
      },
      index: {
        indexType: 'TBI',
        location: {
          localPath: require.resolve(`${file}.tbi`),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
  const features = await firstValueFrom(
    adapter
      .getFeatures({ refName: 'ref#0#ctgA', start: 40000, end: 50000 })
      .pipe(toArray()),
  )
  expect(features.length).toBeGreaterThan(0)
  const [first, second] = reads
  expect([first!.event, second!.event]).toEqual(['start', 'start'])
  expect(first!.position).not.toBe(second!.position)
})
