import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import MotifListAdapter from './MotifListAdapter/MotifListAdapter.ts'
import configSchema from './MotifListAdapter/configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Region } from '@jbrowse/core/util'

class FakeSequenceAdapter {
  constructor(private seq: string) {}
  async getSequence(region: Region) {
    return this.seq.slice(
      Math.max(0, region.start),
      Math.min(this.seq.length, region.end),
    )
  }
  async getRefNames() {
    return ['chr1']
  }
}

// resolves whichever sequence the requested config names, so a test can tell
// the configured slot apart from the RPC-primed config
const sequences: Record<string, string> = {
  fromSlot: 'GAATTC',
  fromAssembly: 'TTTTTTGAATTCTTTTTT',
}

const getSubAdapter = (async (conf: { type: string }) => ({
  dataAdapter: new FakeSequenceAdapter(sequences[conf.type]!),
  sessionIds: new Set<string>(),
})) as unknown as getSubAdapterType

function makeAdapter(conf: Record<string, unknown>) {
  return new MotifListAdapter(
    configSchema.create({ motifs: 'EcoRI\tG^AATTC', ...conf }),
    getSubAdapter,
  )
}

function scan(adapter: MotifListAdapter, end: number) {
  return firstValueFrom(
    adapter
      .getFeatures(
        { assemblyName: 'volvox', refName: 'chr1', start: 0, end },
        {},
      )
      .pipe(toArray()),
  )
}

test('scans the RPC-primed assembly sequence when no slot is configured', async () => {
  const adapter = makeAdapter({})
  adapter.setSequenceAdapterConfig({ type: 'fromAssembly' })

  const features = await scan(adapter, 18)
  expect(features).toHaveLength(1)
  expect(features[0]!.get('start')).toBe(6)
})

test('an explicitly configured slot wins over the primed config', async () => {
  const adapter = makeAdapter({ sequenceAdapter: { type: 'fromSlot' } })
  adapter.setSequenceAdapterConfig({ type: 'fromAssembly' })

  const features = await scan(adapter, 18)
  expect(features).toHaveLength(1)
  // the slot's sequence has the site at 0, the assembly's at 6
  expect(features[0]!.get('start')).toBe(0)
})

test('throws a directive error when neither source is available', async () => {
  await expect(scan(makeAdapter({}), 18)).rejects.toThrow(
    /No sequence adapter available/,
  )
})

test('names the offending adapter when the assembly carries no residues', async () => {
  // a ChromSizes-style assembly resolves fine but has no getSequence, and
  // auto-resolution reaches it without anyone having named a sequence adapter
  const adapter = new MotifListAdapter(
    configSchema.create({ motifs: 'EcoRI\tG^AATTC' }),
    (async () => ({
      dataAdapter: { getRefNames: async () => ['chr1'] },
      sessionIds: new Set<string>(),
    })) as unknown as getSubAdapterType,
  )
  adapter.setSequenceAdapterConfig({ type: 'ChromSizesAdapter' })

  await expect(scan(adapter, 18)).rejects.toThrow(
    /adapter "ChromSizesAdapter" provides no sequence/,
  )
})
