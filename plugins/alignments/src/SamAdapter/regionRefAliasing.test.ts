import { CHAR_CODE_FROM_NIBBLE, referenceNibble } from '@jbrowse/cigar-utils'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './SamAdapter.ts'
import configSchema from './configSchema.ts'

import type { PackedReference } from '@jbrowse/cigar-utils'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'

// The reference-binding fields under test. Structural rather than the
// SamRecordFeature class so the assertions read as "what a fetch handed back",
// and so the test doesn't reach into the class's private state.
interface RegionView {
  ref?: PackedReference
  refOffset: number
  id: () => string
}

// the reference travels packed two bases to a byte; spell it back out so the
// assertions read as the sequence slice the fetch resolved
function unpack(ref: PackedReference | undefined) {
  let out = ''
  for (let i = 0; i < (ref?.length ?? 0); i++) {
    out += String.fromCharCode(CHAR_CODE_FROM_NIBBLE[referenceNibble(ref!, i)]!)
  }
  return out
}

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

// A single MD-less read spanning 0..20, so it is returned by BOTH region fetches
// below — the shape a read straddling two displayedRegions has.
const SAM = [
  '@SQ\tSN:ctgA\tLN:40',
  'spanner\t0\tctgA\t1\t60\t20M\t*\t0\t0\tACGTACGTACGTACGTACGT\t*',
  '',
].join('\n')

function makeAdapter() {
  const adapter = new Adapter(
    configSchema.create({ samText: SAM }),
    getSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig({ type: 'TestSequenceAdapter' })
  return adapter
}

async function fetchRegion(adapter: Adapter, start: number, end: number) {
  const feats = await firstValueFrom(
    adapter
      .getFeatures({ assemblyName: 'test', refName: 'ctgA', start, end })
      .pipe(toArray()),
  )
  return feats as unknown as RegionView[]
}

// SamAdapter caches one feature object per record for the file's lifetime, and a
// display fetches every needed region at once — so binding a region's reference
// slice has to produce a per-fetch view rather than write onto the shared
// record. It used to write, and the last fetch to resolve then relocated the
// read in every other region: an MD-less read overlapping two regions walked one
// region's mismatches against the other region's sequence.
test('parallel region fetches each get their own reference slice', async () => {
  const adapter = makeAdapter()

  // exactly what a display's fetch does: all needed regions in flight at once
  const [leftFeats, rightFeats] = await Promise.all([
    fetchRegion(adapter, 0, 12),
    fetchRegion(adapter, 16, 32),
  ])
  const left = leftFeats[0]!
  const right = rightFeats[0]!

  expect(left).not.toBe(right)
  // each region fetched the sequence its own [start,end) covers (plus
  // seqFetchSpan's one base of right slack, clamped to the region), and the read
  // (start 0) is located relative to that slice
  expect(left.refOffset).toBe(0)
  expect(unpack(left.ref)).toBe(CTGA.slice(0, 12))
  expect(right.refOffset).toBe(-16)
  expect(unpack(right.ref)).toBe(CTGA.slice(16, 21))

  // ids come from the record, not the fetch — read lookups compare them across
  // regions
  expect(left.id()).toBe(right.id())
})

test('a parallel fetch resolves the same reference as a serial one', async () => {
  const serial = makeAdapter()
  const serialLeft = (await fetchRegion(serial, 0, 12))[0]!
  const serialRight = (await fetchRegion(serial, 16, 32))[0]!

  const parallel = makeAdapter()
  const [parallelLeft, parallelRight] = await Promise.all([
    fetchRegion(parallel, 0, 12),
    fetchRegion(parallel, 16, 32),
  ])

  expect(unpack(parallelLeft[0]!.ref)).toBe(unpack(serialLeft.ref))
  expect(parallelLeft[0]!.refOffset).toBe(serialLeft.refOffset)
  expect(unpack(parallelRight[0]!.ref)).toBe(unpack(serialRight.ref))
  expect(parallelRight[0]!.refOffset).toBe(serialRight.refOffset)
})
