import {
  SLE_ADAPTER,
  SLE_INDEX_START,
  SLE_REGION,
  slePluginManager,
} from '../GWASAdapter/sle.fixture.ts'
import { LD_INDEX_COLOR } from './ldPlot.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { CategoricalEntry } from '@jbrowse/core/ui/colorScale'
import type { EncodedLayersResult } from '@jbrowse/core/util/markEncoding'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

async function ldColoredOverSle() {
  const pluginManager = slePluginManager()
  const { display } = createTestEnvironment().createDisplay()
  display.setLdColoring(true)
  const { value } = (await pluginManager
    .getRpcMethodType('CoreGetEncodedLayers')
    .invoke({
      sessionId: 's',
      adapterConfig: SLE_ADAPTER,
      region: SLE_REGION,
      layers: display.layerRequests,
      opts: { ld: { index: { start: SLE_INDEX_START }, refName: '2' } },
    })) as { value: EncodedLayersResult }
  display.setRpcData(0, value, REGION)
  return display
}

// The worker's own tables over the SLE statistics, nine of whose SNPs the LD
// file does not name.
test('LD colouring keys the r² bins and the index SNP as a pink diamond, and names no value "(no value)"', async () => {
  const display = await ldColoredOverSle()
  const keys = display.colorScales.map(s => ({
    title: s.title,
    entries: s.kind === 'categorical' ? s.entries : [],
  }))
  const labels = (entries: CategoricalEntry[]) => entries.map(e => e.label)
  expect(keys.map(k => k.title)).toEqual(['r² to index SNP', undefined])
  expect(labels(keys[0]!.entries)).toEqual([
    '≥ 0.8',
    '0.6 – 0.8',
    '0.4 – 0.6',
    '0.2 – 0.4',
    '< 0.2',
    'No LD data',
  ])
  expect(keys[1]!.entries).toEqual([
    expect.objectContaining({
      label: 'Index SNP',
      swatches: [{ color: LD_INDEX_COLOR, shape: 'diamond' }],
    }),
  ])
  expect(keys.flatMap(k => labels(k.entries))).not.toContain('(no value)')
})

test('the top hit is the index SNP once the join moves it into its own mark', async () => {
  const display = await ldColoredOverSle()
  expect(display.topSnp).toBe(`ctgA:${SLE_INDEX_START + 1}`)
  expect(display.indexSnpMissing).toBe(false)
})
