import PluginManager from '@jbrowse/core/PluginManager'
import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import { waitFor } from '@testing-library/react'
import { autorun } from 'mobx'

import { variantCellData } from '../VariantRPC/executeVariantCellData.ts'
import VariantsPlugin from '../index.ts'
import { cellFill } from '../shared/cellFill.ts'
import { MENDELIAN_FIELD } from '../shared/trios.ts'
import { getCachedABGR } from '../shared/variantWebglUtils.ts'
import { RECORDS_BAND_OFF, createTestEnvironment } from './testEnv.ts'

const PARENTS = [{ name: 'dad' }, { name: 'mom' }]
const KID = { name: 'kid', father: 'dad', mother: 'mom', sex: 'male' }
const [NOT_IN_PARENTS_COLOR] = UNIVERSAL_FIELD_PRESETS.mendelian.scale.range

describe('the fetch key', () => {
  test('carries the trios the pedigree names, whichever row draws', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources([{ name: 'kid' }, ...PARENTS])
    const unrelated = display.rpcProps()

    display.setSources([KID, ...PARENTS])

    expect(unrelated.trios).toEqual([])
    expect(display.rpcProps().trios).toEqual([
      { child: 'kid', father: 'dad', mother: 'mom', sex: 'male' },
    ])
    expect(display.rpcProps()).not.toEqual(unrelated)
  })

  test('holds no transmission entries for a track with no trio', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources([{ name: 'kid' }, ...PARENTS])

    expect(display.rpcProps()).not.toHaveProperty('transmissionEntries')
  })

  test('carries the assembly’s transmission entries', () => {
    const env = createTestEnvironment()
    const { display: autosomal } = env.createDisplay()
    autosomal.setSources([KID, ...PARENTS])
    const configuration =
      getSession(autosomal).assemblyManager.get('volvox')?.configuration
    const before = autosomal.rpcProps()

    Object.assign(configuration ?? {}, {
      transmission: [{ refName: 'ctgA', sex: 'male', from: 'mother' }],
    })
    const { display } = env.createDisplay()
    display.setSources([KID, ...PARENTS])

    expect(before.transmissionEntries).toEqual([])
    expect(display.rpcProps().transmissionEntries).toEqual([
      { refName: 'ctgA', sex: 'male', from: 'mother' },
    ])
    expect(display.rpcProps()).not.toEqual(before)
  })
})

// trio_x.vcf: x1 1/1 from 0/0 x 0/1, inconsistent with no rule; x2 0/1
// from 0/0 x 0/0, not in parents; x3 0/1 from 0/1 x 0/0, consistent
async function fetchedAs(props: Record<string, unknown>) {
  const pluginManager = new PluginManager([new VariantsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const result = await variantCellData({
    pluginManager,
    args: {
      sessionId: 'mendelianCheck',
      adapterConfig: {
        type: 'VcfAdapter',
        vcfLocation: {
          localPath: require.resolve('../VcfAdapter/test_data/trio_x.vcf'),
          locationType: 'LocalPathLocation',
        },
      },
      regions: [
        {
          assemblyName: 'volvox',
          refName: 'NC_000023.11',
          start: 0,
          end: 1000,
        },
      ],
      siteFilter: [],
      rowsField: 'sample',
      layout: 'genomic',
      ...props,
    },
  })
  if (isRegionRefused(result)) {
    throw new Error('refused')
  }
  return result.value
}

function displayWith(filter: Record<string, unknown>[]) {
  const { display } = createTestEnvironment({
    displayConfig: { ...RECORDS_BAND_OFF, filter },
  }).createDisplay()
  display.setSources([KID, ...PARENTS])
  display.colorByField(MENDELIAN_FIELD)
  return display
}

test('a site in neither parent paints the check’s color', async () => {
  const display = displayWith([])
  display.setCellData(await fetchedAs(display.rpcProps()))
  const dispose = autorun(() => {
    void display.perRegionCellMap
  })
  const data = display.perRegionCellMap.get(0)!
  const kidRow = display.drawnRows.findIndex(row => row.name === 'kid')
  const x2 = data.featureInfo.findIndex(info => info.name === 'x2')
  const cell = [...data.cellFeatureIndices.slice(0, data.numCells)].findIndex(
    (feature, i) => feature === x2 && data.cellRowIndices[i] === kidRow,
  )

  expect(data.cellColors[cell]).toBe(
    getCachedABGR(cellFill(NOT_IN_PARENTS_COLOR, 128)),
  )
  expect(display.paintedDomain).toEqual(
    expect.arrayContaining(['notInParents', 'inconsistent', 'consistent']),
  )
  dispose()
})

test('a filter entry on the check reaches the worker, which keeps the sites it names', async () => {
  const display = displayWith([
    { field: MENDELIAN_FIELD, equal: 'notInParents' },
  ])
  const props = display.rpcProps()
  const fetched = await fetchedAs(props)

  expect(props.filters).toBeUndefined()
  expect(props.mendelianFilter).toEqual([
    { field: MENDELIAN_FIELD, equal: 'notInParents' },
  ])
  expect(fetched.simplifiedFeatures.map(f => f.data.name)).toEqual(['x2'])
})

test('the feature widget’s calls take the rule of the record’s refName under its alias', () => {
  const env = createTestEnvironment()
  const { display: first } = env.createDisplay()
  Object.assign(
    getSession(first).assemblyManager.get('volvox')?.configuration ?? {},
    { transmission: [{ refName: 'ctgA', sex: 'male', from: 'mother' }] },
  )
  const { display } = env.createDisplay()
  display.setSources([KID, ...PARENTS])
  const record = new SimpleFeature({
    uniqueId: 'x1',
    refName: 'chrA',
    start: 99,
    end: 100,
    genotypes: { kid: '1/1', dad: '0/0', mom: '0/1' },
  })

  expect(display.trioCallsAt(record)).toEqual([
    { ...display.trios[0], call: 'consistent' },
  ])
})

test('the cell fetch sends each region’s rule, resolved through the assembly’s aliases', async () => {
  const env = createTestEnvironment({ displayConfig: RECORDS_BAND_OFF })
  const { display: first } = env.createDisplay()
  Object.assign(
    getSession(first).assemblyManager.get('volvox')?.configuration ?? {},
    { transmission: [{ refName: 'chrA', sex: 'male', from: 'mother' }] },
  )
  env.mockRpcCall.mockImplementation((_sid: string, method: string) =>
    method === 'MultiSampleVariantGetSources'
      ? Promise.resolve({ sources: [KID, ...PARENTS], warnings: [] })
      : new Promise(() => {}),
  )
  env.createDisplay()

  const cellDataArgs = () =>
    env.mockRpcCall.mock.calls.find(
      ([, method]) => method === 'MultiSampleVariantGetCellData',
    )?.[2]
  await waitFor(() => {
    expect(cellDataArgs()).toBeDefined()
  })

  expect(cellDataArgs()).toMatchObject({
    regions: [expect.objectContaining({ refName: 'ctgA' })],
    trios: [{ child: 'kid', father: 'dad', mother: 'mom', sex: 'male' }],
    transmission: [[{ refName: 'chrA', sex: 'male', from: 'mother' }]],
  })
})
