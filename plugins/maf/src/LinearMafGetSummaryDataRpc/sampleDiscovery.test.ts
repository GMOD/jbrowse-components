import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { of } from 'rxjs'

import { executeMafSummaryData } from './executeMafSummaryData.ts'

import type { MafSummaryRecord, Sample } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

// `mock`-prefixed so the jest.mock factory below may close over it (the factory
// is hoisted above the file's other declarations).
const mockLoadMafSamplesAdapter = jest.fn()

jest.mock('../util/loadMafSamplesAdapter.ts', () => ({
  loadMafSamplesAdapter: (...args: unknown[]) =>
    mockLoadMafSamplesAdapter(...args) as unknown,
}))

function record(src: string, start: number): MafSummaryRecord {
  return { refName: 'ctgA', start, end: start + 100, src, score: 1 }
}

// The rows the summary file carries, in file order: `volvox` first because MAF
// lists the reference first, then the two aligned species.
const RECORDS = [
  record('volvox', 0),
  record('simvolvox', 0),
  record('microvolvox', 0),
  record('simvolvox', 200),
]

// This suite never passes a `byteLimit`, so the executor measures nothing and
// the refusal arm of its return is unreachable. Narrowed once here rather than
// at every assertion.
function payload<T>(result: T | RegionTooLargeResult) {
  if (isRegionRefused(result)) {
    throw new Error('unexpected region-too-large result')
  }
  return result
}

async function run({
  samples,
  subtreeFilter,
}: {
  samples: Sample[]
  subtreeFilter?: string[]
}) {
  mockLoadMafSamplesAdapter.mockResolvedValue({
    adapter: { getSummaryFeatures: () => of(...RECORDS) },
    samples,
    treeNewick: undefined,
  })
  return payload(
    await executeMafSummaryData({
      pluginManager: {} as PluginManager,
      args: {
        adapterConfig: {},
        sessionId: 'test',
        regions: [
          { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
        ],
        subtreeFilter,
      },
    }),
  )
}

// A sample-discovery track has no `samples` and no `nhLocation`, so nothing
// names its rows until a fetch does. Only the alignment path used to, and the
// summary path is exactly where that fetch does not happen: opened already
// zoomed out past the force-load floor, the display resolved zero sources, so
// `rowIndexBySrc` matched no `src` and the summary overlay drew nothing at all —
// a blank track that reported itself fully loaded, until the user zoomed in far
// enough to trigger the detail fetch.
describe('the summary RPC names the species its own records carry', () => {
  it('discovers the row set when none is configured', async () => {
    const out = await run({ samples: [] })
    // first-seen order, deduped
    expect(out.samples).toEqual([
      { id: 'volvox', label: 'volvox' },
      { id: 'simvolvox', label: 'simvolvox' },
      { id: 'microvolvox', label: 'microvolvox' },
    ])
    // ...and non-canonical, so the client unions it into rows the alignment
    // path may already have discovered rather than replacing them
    expect(out.samplesCanonical).toBe(false)
  })

  it('discovers over the whole file, not just the visible subtree', async () => {
    const out = await run({ samples: [], subtreeFilter: ['simvolvox'] })
    // the sidebar tree and "clear filter" need every genome, so discovery runs
    // before the filter — exactly as the alignment path discovers from every
    // block row before narrowing `blocks`
    expect(out.samples.map(s => s.id)).toEqual([
      'volvox',
      'simvolvox',
      'microvolvox',
    ])
    // the records themselves are still narrowed
    expect(out.records.every(r => r.src === 'simvolvox')).toBe(true)
  })

  it('leaves a configured row set alone and reports it canonical', async () => {
    const configured = [
      { id: 'volvox', label: 'Volvox' },
      { id: 'simvolvox', label: 'Sim' },
    ]
    const out = await run({ samples: configured })
    expect(out.samples).toEqual(configured)
    expect(out.samplesCanonical).toBe(true)
  })
})
