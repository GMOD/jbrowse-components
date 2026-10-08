import PluginManager from '@jbrowse/core/PluginManager'
import { LD_NOT_COMPUTED } from '@jbrowse/ld-core'

import VariantsPlugin from '../index.ts'
import { getLDMatrixFromPlink } from './getLDMatrixFromPlink.ts'
import { bandPairIndex } from './ldBand.ts'

function ldMatrix(start: number, end: number) {
  return ldMatrixOf('example.ld', [{ start, end }])
}

function ldMatrixOf(file: string, spans: { start: number; end: number }[]) {
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
          localPath: require.resolve(`../PlinkLDAdapter/test_data/${file}`),
          locationType: 'LocalPathLocation',
        },
      },
      regions: spans.map(span => ({
        assemblyName: 'a',
        refName: '1',
        ...span,
      })),
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

test('a pair spanning two displayed blocks loads', async () => {
  const { snps, ldValues, band } = await ldMatrixOf('example.ld', [
    { start: 900, end: 1100 },
    { start: 1900, end: 2100 },
  ])
  expect(snps.map(s => s.id)).toEqual(['rsLEAD', 'rsD'])
  expect(ldValues[bandPairIndex(0, 1, band)]).toBeCloseTo(0.05)
})

test('two variants at one position keep a column each', async () => {
  const { snps, ldValues, band } = await ldMatrixOf('colocated.ld', [
    { start: 0, end: 5000 },
  ])
  expect(snps.map(s => s.id)).toEqual(['rs1', 'rs2', 'rs3'])
  expect(ldValues[bandPairIndex(0, 1, band)]).toBeCloseTo(0.9)
  expect(ldValues[bandPairIndex(0, 2, band)]).toBeCloseTo(0.4)
  expect(ldValues[bandPairIndex(1, 2, band)]).toBeCloseTo(0.6)
})
