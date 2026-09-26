import PluginManager from '@jbrowse/core/PluginManager'
import { LD_NOT_COMPUTED } from '@jbrowse/ld-core'

import VariantsPlugin from '../index.ts'
import { getLDMatrixFromPlink } from './getLDMatrixFromPlink.ts'
import { bandPairIndex } from './ldBand.ts'

function ldMatrix(start: number, end: number) {
  const pluginManager = new PluginManager([new VariantsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return getLDMatrixFromPlink({
    pluginManager,
    args: {
      sessionId: 'ldMatrix',
      adapterConfig: {
        type: 'PlinkLDAdapter',
        ldLocation: {
          localPath: require.resolve('../PlinkLDAdapter/test_data/example.ld'),
          locationType: 'LocalPathLocation',
        },
      },
      regions: [{ assemblyName: 'a', refName: '1', start, end }],
    },
  })
}

test('a SNP spans the base its 1-based BP names', async () => {
  const { snps } = await ldMatrix(0, 5000)
  expect(snps.map(s => [s.id, s.start, s.end])).toEqual([
    ['rsLEAD', 999, 1000],
    ['rsB', 1199, 1200],
    ['rsC', 1499, 1500],
    ['rsD', 1999, 2000],
  ])
})

test('a region keeps a SNP on its last base', async () => {
  const { snps } = await ldMatrix(999, 1500)
  expect(snps.map(s => s.id)).toEqual(['rsLEAD', 'rsB', 'rsC'])
})

// every record in the file pairs with rsLEAD at BP 1000, the base [999, 1000)
test('a region starting at a SNP’s BP leaves that SNP out', async () => {
  const { snps } = await ldMatrix(1000, 5000)
  expect(snps).toEqual([])
})

test('a pair the file does not list is not computed', async () => {
  const { ldValues, band } = await ldMatrix(0, 5000)
  expect(ldValues[bandPairIndex(0, 1, band)]).toBeCloseTo(0.82)
  expect(ldValues[bandPairIndex(1, 2, band)]).toBe(LD_NOT_COMPUTED)
})
