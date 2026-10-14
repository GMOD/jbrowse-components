import PluginManager from '@jbrowse/core/PluginManager'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import GWASAdapter from './GWASAdapter.ts'
import GWASAdapterConfigSchema from './configSchema.ts'
import { INDEX_SNP_MISSING } from './ldJoin.ts'
import {
  SLE_ADAPTER,
  SLE_INDEX_START,
  SLE_REGION,
  SleLDAdapter,
  slePluginManager,
} from './sle.fixture.ts'
import { readTopHit } from './topHit.ts'

import type { GWASFetchOptions, LdJoin } from './ldJoin.ts'
import type { Feature } from '@jbrowse/core/util'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const file = require.resolve('../../../../test_data/volvox/volvox.gwas.tsv.gz')

async function scores(scoreTransform: string) {
  const adapter = new GWASAdapter(
    GWASAdapterConfigSchema.create(
      {
        bedGzLocation: { localPath: file, locationType: 'LocalPathLocation' },
        index: {
          location: {
            localPath: `${file}.tbi`,
            locationType: 'LocalPathLocation',
          },
        },
        scoreTransform,
      },
      { pluginManager },
    ),
    undefined,
    pluginManager,
  )
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 200,
        assemblyName: 'volvox',
      })
      .pipe(toArray()),
  )
  return features.map(f => f.get('score')!)
}

test('a jexl: scoreTransform is evaluated per score', async () => {
  const raw = await scores('none')
  expect(raw.length).toBeGreaterThan(0)
  expect(await scores('jexl:score * 10')).toEqual(raw.map(s => s * 10))
})

describe('an LD join asked for through the fetch options', () => {
  async function sle(opts: GWASFetchOptions = {}, region = SLE_REGION) {
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: slePluginManager(),
      sessionId: 's',
      adapterConfig: SLE_ADAPTER,
    })
    return dataAdapter.getFeaturesArray(region, opts)
  }
  const named = (features: Feature[], name: string) =>
    features.find(f => f.get('name') === name)!

  it("writes each SNP its r² to the index, read from the adapter's ldAdapter", async () => {
    const features = await sle({
      ld: { start: SLE_INDEX_START, refName: '2' },
    })
    const index = named(features, 'rs4274624')
    const partner = named(features, 'rs193239665')
    expect([index.get('r2'), index.get('ld_role')]).toEqual([1, 'index'])
    expect(partner.get('r2')).toBeCloseTo(0.037)
    expect(partner.get('ld_role')).toBe('partner')
    expect(partner.get('beta')).toBe('0.3293')
  })

  it('leaves every feature alone without one', async () => {
    const features = await sle()
    expect(features.length).toBeGreaterThan(100)
    expect(features.some(f => f.get('r2') !== undefined)).toBe(false)
  })

  it('joins only the index where the LD file is asked under another name', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const features = await sle({
      ld: { start: SLE_INDEX_START, refName: 'chr2' },
    })
    expect(features.filter(f => f.get('r2') !== undefined)).toEqual([
      named(features, 'rs4274624'),
    ])
    warn.mockRestore()
  })

  it('notes a region holding the index SNP that no partner joined to, and only that', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const noticesOf = async (ld: LdJoin) => {
      const notices: string[] = []
      await sle({ ld, notices })
      return notices
    }
    expect(
      await noticesOf({ start: SLE_INDEX_START, refName: 'chr2' }),
    ).toEqual([INDEX_SNP_MISSING])
    expect(await noticesOf({ start: SLE_INDEX_START, refName: '2' })).toEqual(
      [],
    )
    expect(
      await noticesOf({ start: SLE_INDEX_START + 1, refName: '2' }),
    ).toEqual([])
    warn.mockRestore()
  })

  it('notes nothing for a region too narrow to hold a partner', async () => {
    const notices: string[] = []
    const features = await sle(
      { ld: { start: SLE_INDEX_START, refName: '2' }, notices },
      { ...SLE_REGION, start: SLE_INDEX_START - 50, end: SLE_INDEX_START + 50 },
    )
    expect(features.map(f => f.get('ld_role'))).toEqual(['index'])
    expect(notices).toEqual([])
  })

  // The window follows the index, so a pan under one index reads the same
  // rows of the LD file.
  it('reads the LD file once per index SNP', async () => {
    clearAdapterCache()
    const read = jest.spyOn(SleLDAdapter.prototype, 'getLDRecords')
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: slePluginManager(),
      sessionId: 's',
      adapterConfig: SLE_ADAPTER,
    })
    const fetch = (start: number, region = SLE_REGION) => {
      const opts: GWASFetchOptions = { ld: { start, refName: '2' } }
      return dataAdapter.getFeaturesArray(region, opts)
    }
    await fetch(SLE_INDEX_START)
    const panned = await fetch(SLE_INDEX_START, {
      ...SLE_REGION,
      start: SLE_REGION.start + 100_000,
    })
    expect(read).toHaveBeenCalledTimes(1)
    expect(panned.some(f => f.get('ld_role') === 'partner')).toBe(true)
    await fetch(SLE_INDEX_START + 1)
    expect(read).toHaveBeenCalledTimes(2)
    read.mockRestore()
  })

  // The index the join follows is read off the file, so the join it leads to
  // cannot move it.
  it('reports the same top hit with and without a join', async () => {
    const reported = async (opts: GWASFetchOptions) => {
      const facts: Record<string, unknown> = {}
      const features = await sle({ ...opts, facts })
      return { top: readTopHit(facts)!, features }
    }
    const { top, features } = await reported({})
    expect(top.score).toBe(Math.max(...features.map(f => f.get('score')!)))
    const joined = await reported({ ld: { start: top.start, refName: '2' } })
    expect(joined.top).toEqual(top)
  })
})
