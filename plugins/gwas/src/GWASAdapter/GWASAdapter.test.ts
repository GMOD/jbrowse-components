import PluginManager from '@jbrowse/core/PluginManager'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import GWASAdapter from './GWASAdapter.ts'
import GWASAdapterConfigSchema from './configSchema.ts'
import {
  SLE_ADAPTER,
  SLE_INDEX_START,
  SLE_REGION,
  slePluginManager,
} from './sle.fixture.ts'

import type { GWASFetchOptions } from './ldJoin.ts'
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
  async function sle(opts: GWASFetchOptions = {}) {
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: slePluginManager(),
      sessionId: 's',
      adapterConfig: SLE_ADAPTER,
    })
    return dataAdapter.getFeaturesArray(SLE_REGION, opts)
  }
  const named = (features: Feature[], name: string) =>
    features.find(f => f.get('name') === name)!

  it("writes each SNP its r² to the index, read from the adapter's ldAdapter", async () => {
    const features = await sle({
      ld: { index: { start: SLE_INDEX_START }, refName: '2' },
    })
    const index = named(features, 'rs4274624')
    const partner = named(features, 'rs193239665')
    expect([index.get('ld'), index.get('ld_role')]).toEqual([1, 'index'])
    expect(partner.get('ld')).toBeCloseTo(0.037)
    expect(partner.get('ld_role')).toBe('partner')
    expect(partner.get('beta')).toBe('0.3293')
  })

  it('leaves every feature alone without one', async () => {
    const features = await sle()
    expect(features.length).toBeGreaterThan(100)
    expect(features.some(f => f.get('ld') !== undefined)).toBe(false)
  })

  it('joins only the index where the LD file is asked under another name', async () => {
    const features = await sle({
      ld: { index: { start: SLE_INDEX_START }, refName: 'chr2' },
    })
    expect(features.filter(f => f.get('ld') !== undefined)).toEqual([
      named(features, 'rs4274624'),
    ])
  })
})
