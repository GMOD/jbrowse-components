import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './Gff3TabixAdapter.ts'
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

// Features need no header read, and the probe for a line declaring the
// sequence circular reads only what overlaps its first base, which here is
// nothing: a cold load is the region's read alone.
test('the first load reads the region and nothing else', async () => {
  const dir = '../../../../test_data/dog10k/omia_dog_variants.gff3.gz'
  const adapter = new Adapter(
    configSchema.create({
      gffGzLocation: {
        localPath: require.resolve(dir),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve(`${dir}.csi`),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'dog',
        refName: 'chr1',
        start: 40000000,
        end: 90000000,
      })
      .pipe(toArray()),
  )
  expect(features.length).toBeGreaterThan(0)
  expect(reads.map(r => r.event)).toEqual(['start', 'end'])
})
