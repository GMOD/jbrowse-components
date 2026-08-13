import { LocalFile } from 'generic-filehandle2'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import { SequenceAdapter } from '../CramAdapter/CramTestAdapters.ts'
import {
  buildReadInterchrom,
  buildReadNextRefs,
  nextRefAt,
  nextRefsToTable,
} from './readNextRefs.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'

const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => ({
  dataAdapter: new SequenceAdapter(
    new LocalFile(require.resolve('../../test_data/volvox.fa')),
  ),
  sessionIds: new Set(),
})

async function bamFeatures() {
  const adapter = new BamAdapter(
    bamConfigSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
    getVolvoxSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig({ type: 'TestSequenceAdapter' })
  return firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 1,
        end: 10200,
      })
      .pipe(toArray()),
  )
}

// The whole contract: the slot table answers exactly what a string per read
// answered. The BAM path never asks a feature for `next_ref` except once per
// contig, so this is what stands between it and a table that is silently one
// slot out.
test('BAM resolves one name per contig and still answers per read', async () => {
  const features = await bamFeatures()
  expect(features.length).toBeGreaterThan(0)
  // The path under test is the refId one — asserted, not assumed, since the
  // fallback would pass every check below while doing the work this avoids.
  expect(
    (features[0] as Feature & { nextRefId?: number }).nextRefId,
  ).toBeDefined()
  const table = buildReadNextRefs(features)
  for (let i = 0; i < features.length; i++) {
    expect(nextRefAt(table, i)).toBe(features[i]!.get('next_ref') ?? '')
  }
  // volvox-sorted's mates are all on ctgA, which is the point: 1 name for
  // however many reads.
  expect(table.nextRefNames.length).toBeLessThanOrEqual(2)
})

describe('nextRefsToTable', () => {
  test('interns repeats and keeps first-seen order', () => {
    const t = nextRefsToTable(['chr2', 'chr1', 'chr2'])
    expect(t.nextRefNames).toEqual(['chr2', 'chr1'])
    expect([...t.readNextRefIds]).toEqual([0, 1, 0])
  })

  // An unpaired read has no mate reference at all, and that is a slot of -1
  // rather than an entry in the table — otherwise '' would occupy a slot and
  // `buildReadInterchrom` would have to special-case it twice.
  test('no mate is the -1 slot, not a table entry', () => {
    const t = nextRefsToTable(['', 'chr1', ''])
    expect(t.nextRefNames).toEqual(['chr1'])
    expect([...t.readNextRefIds]).toEqual([-1, 0, -1])
    expect(nextRefAt(t, 0)).toBe('')
    expect(nextRefAt(t, 2)).toBe('')
  })

  test('reads past the end have no mate reference', () => {
    expect(nextRefAt(nextRefsToTable([]), 0)).toBe('')
  })
})

describe('buildReadInterchrom', () => {
  test('flags reads whose mate is on a different chromosome', () => {
    const t = nextRefsToTable(['chr1', 'chr2', 'chr1'])
    expect([...buildReadInterchrom(t, 'chr1', 3)]).toEqual([0, 1, 0])
  })

  test('no mate is not interchromosomal', () => {
    const t = nextRefsToTable(['', 'chr2'])
    expect([...buildReadInterchrom(t, 'chr1', 2)]).toEqual([0, 1])
  })

  test('an empty table yields all zeros of the read count', () => {
    const t = nextRefsToTable([])
    expect([...buildReadInterchrom(t, 'chr1', 3)]).toEqual([0, 0, 0])
  })
})

describe('buildReadNextRefs without a refId', () => {
  const feat = (name: string) =>
    ({ get: (f: string) => (f === 'next_ref' ? name : undefined) }) as Feature

  test('falls back to the names it can only get as strings', () => {
    const t = buildReadNextRefs([feat('chr1'), feat(''), feat('chr1')])
    expect(t.nextRefNames).toEqual(['chr1'])
    expect([...t.readNextRefIds]).toEqual([0, -1, 0])
  })
})
