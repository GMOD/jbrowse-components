import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './SamAdapter.ts'
import configSchema from './configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'

const CTGA = 'ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGT'

class TestSequenceAdapter extends BaseSequenceAdapter {
  constructor() {
    super(ConfigurationSchema('empty', {}).create())
  }
  async getRefNames() {
    return ['ctgA']
  }
  async getRegions() {
    return [{ refName: 'ctgA', start: 0, end: CTGA.length }]
  }
  getFeatures({ start, end }: { refName: string; start: number; end: number }) {
    return ObservableCreate<Feature>(observer => {
      observer.next(
        new SimpleFeature({
          uniqueId: `ctgA-${start}-${end}`,
          refName: 'ctgA',
          start,
          end,
          seq: CTGA.slice(start, end),
        }),
      )
      observer.complete()
    })
  }
}
const getSequenceSubAdapter: getSubAdapterType = async () => ({
  dataAdapter: new TestSequenceAdapter(),
  sessionIds: new Set(),
})

// one MD-less read at 0..8, one at 20..28. Two "displayed regions" are fetched
// in parallel, as MultiRegionDisplayMixin's fetchNeeded does.
const SAM = [
  '@SQ\tSN:ctgA\tLN:40',
  // one MD-less read spanning 0..20, so BOTH region fetches below return it
  'spanner\t0\tctgA\t1\t60\t20M\t*\t0\t0\tACGTACGTACGTACGTACGT\t*',
  '',
].join('\n')

function fetchRegion(adapter: Adapter, start: number, end: number) {
  return firstValueFrom(
    adapter
      .getFeatures({ assemblyName: 'test', refName: 'ctgA', start, end })
      .pipe(toArray()),
  )
}

test('parallel region fetches alias the shared record refOffset', async () => {
  const adapter = new Adapter(
    configSchema.create({ samText: SAM }),
    getSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig({ type: 'TestSequenceAdapter' })

  // exactly what fetchNeeded does: all needed regions in flight at once
  const [leftFeats, rightFeats] = await Promise.all([
    fetchRegion(adapter, 0, 12),
    fetchRegion(adapter, 16, 32),
  ])

  const left = leftFeats[0] as unknown as { ref?: string; refOffset: number }
  const right = rightFeats[0] as unknown as { ref?: string; refOffset: number }
  console.log('same object?', left === right)
  console.log(
    'left  refOffset',
    left.refOffset,
    'ref',
    JSON.stringify(left.ref),
  )
  console.log(
    'right refOffset',
    right.refOffset,
    'ref',
    JSON.stringify(right.ref),
  )

  // region [0,12) fetched ref span [0,12), so the read (start 0) sits at offset 0
  expect(left.refOffset).toBe(0)
})
