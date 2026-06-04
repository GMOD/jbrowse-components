import { SimpleFeature } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BigMafAdapter from './BigMafAdapter.ts'
import configSchema from './configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'

// Mirrors what BigBedAdapter produces over a real UCSC bigMafSummary.bb: one
// feature per species at a block's coords, autoSql columns as named getters,
// and statuses that may be blank (verified against the mouseStrains hub).
const summaryRows = [
  { src: '129S1_SvImJ', score: 0.97, leftStatus: '', rightStatus: '' },
  { src: 'A_J', score: 0.96, leftStatus: 'I', rightStatus: 'C' },
]

function makeSummaryFeature(row: (typeof summaryRows)[number], i: number) {
  return new SimpleFeature({
    uniqueId: `f${i}`,
    refName: 'chr1',
    start: 0,
    end: 10028,
    ...row,
  })
}

const getSummarySubAdapter: getSubAdapterType = async () => ({
  dataAdapter: {
    getFeatures: () =>
      ObservableCreate<Feature>(observer => {
        for (const [i, r] of summaryRows.entries()) {
          observer.next(makeSummaryFeature(r, i))
        }
        observer.complete()
      }),
  } as unknown as Awaited<ReturnType<getSubAdapterType>>['dataAdapter'],
  sessionIds: new Set<string>(),
})

const query = { assemblyName: 'mm', refName: 'chr1', start: 0, end: 20000 }

test('getSummaryFeatures maps autoSql columns and tolerates blank status', async () => {
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

  expect(records).toEqual([
    {
      refName: 'chr1',
      start: 0,
      end: 10028,
      src: '129S1_SvImJ',
      score: 0.97,
      leftStatus: undefined,
      rightStatus: undefined,
    },
    {
      refName: 'chr1',
      start: 0,
      end: 10028,
      src: 'A_J',
      score: 0.96,
      leftStatus: 'I',
      rightStatus: 'C',
    },
  ])
})

test('getSummaryFeatures emits nothing when no summaryAdapter configured', async () => {
  const adapter = new BigMafAdapter(
    configSchema.create({ type: 'BigMafAdapter' }),
    getSummarySubAdapter,
  )

  const records = await firstValueFrom(
    adapter.getSummaryFeatures(query).pipe(toArray()),
  )

  expect(records).toEqual([])
})
