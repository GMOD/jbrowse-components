import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

// plugin-maf loads the summary BigBed through the plugin system at runtime;
// in tests we wire a real BigBedAdapter directly as the sub-adapter so the
// autoSql column naming (src/score/leftStatus/rightStatus) is exercised end to
// end against a real UCSC bigMafSummary.bb.
import BigBedAdapter from '../../../bed/src/BigBedAdapter/BigBedAdapter.ts'
import bigBedConfigSchema from '../../../bed/src/BigBedAdapter/configSchema.ts'
import BigMafAdapter from './BigMafAdapter.ts'
import configSchema from './configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

// 50kb fixture: cactus447way bigMafSummary chr1:1,000,000-1,050,000 extracted
// with bigBedToBed + rebuilt with bedToBigBed -type=bed3+4 -as=mafSummary.as,
// preserving the real autoSql + scores + C/I status chars.
const summaryAdapter = new BigBedAdapter(
  bigBedConfigSchema.create({
    type: 'BigBedAdapter',
    bigBedLocation: {
      localPath: require.resolve('../../test_data/cactus447way.summary.bb'),
      locationType: 'LocalPathLocation',
    },
  }),
)

const getSummarySubAdapter: getSubAdapterType = async () => ({
  dataAdapter: summaryAdapter,
  sessionIds: new Set<string>(),
})

const query = {
  assemblyName: 'hg38',
  refName: 'chr1',
  start: 970000,
  end: 1010000,
}

test('getSummaryFeatures reads a real bigMafSummary.bb through BigBedAdapter', async () => {
  const adapter = new BigMafAdapter(
    configSchema.create({
      type: 'BigMafAdapter',
      summaryAdapter: { type: 'BigBedAdapter' },
    }),
    getSummarySubAdapter,
  )

  const records = await firstValueFrom(
    adapter.getSummaryFeatures(query).pipe(toArray()),
  )

  // one row per species per block, all on chr1
  expect(records.length).toBeGreaterThan(100)
  expect(records.every(r => r.refName === 'chr1')).toBe(true)

  // src/score/status columns come through named from the autoSql
  const pongo = records.find(r => r.src === 'Pongo_abelii')
  expect(pongo).toBeDefined()
  expect(pongo!.score).toBeGreaterThan(0)
  expect(pongo!.score).toBeLessThanOrEqual(1)

  // C/I status chars map through toMafStatus; the fixture carries both
  const statuses = new Set(
    records.flatMap(r => [r.leftStatus, r.rightStatus].filter(Boolean)),
  )
  expect(statuses.has('C')).toBe(true)
  expect(statuses.has('I')).toBe(true)
})
