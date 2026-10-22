import HicAdapter from './HicAdapter.ts'
import configSchema from './configSchema.ts'

import type { Region } from '@jbrowse/core/util/types'

const HIC = require.resolve('../../../../extra_test_data/test.hic')
const LOCATION = { localPath: HIC, locationType: 'LocalPathLocation' }

// The map against itself: every cell joins its own copy and both averages
// match, so a ratio other than 1 anywhere is the join or the scaling
function selfControlled() {
  return new HicAdapter(
    configSchema.create({
      hicLocation: LOCATION,
      controlAdapter: { type: 'HicAdapter', hicLocation: LOCATION },
    }),
    config =>
      Promise.resolve({
        dataAdapter: new HicAdapter(configSchema.create(config)),
        sessionIds: new Set<string>(),
      }),
  )
}

const REGIONS: Region[] = [
  { assemblyName: 'hg19', refName: '1', start: 0, end: 249_250_621 },
  { assemblyName: 'hg19', refName: '2', start: 0, end: 243_199_373 },
]

test('the header offers what both files hold and says a control is there', async () => {
  const header = await selfControlled().getHeader()
  expect(header.hasControl).toBe(true)
  expect(header.resolutions).toEqual([2_500_000, 100_000])
  expect(header.norms).toContain('KR')
})

test('a map against itself joins every cell to its own copy', async () => {
  const adapter = selfControlled()
  const alone = await new HicAdapter(
    configSchema.create({ hicLocation: LOCATION }),
  ).getMultiRegionContactRecords(REGIONS, {
    resolution: 2_500_000,
    normalization: 'KR',
  })
  const { pairs, numContacts } = await adapter.getMultiRegionContactRecords(
    REGIONS,
    { resolution: 2_500_000, normalization: 'KR', control: true },
  )
  expect(numContacts).toBe(alone.numContacts)
  for (const pair of pairs) {
    const { control, counts } = pair
    expect(control).toBeDefined()
    expect(control!.controlDepth).toBe(control!.depth)
    expect(Array.from(control!.counts)).toEqual(Array.from(counts))
  }
})
