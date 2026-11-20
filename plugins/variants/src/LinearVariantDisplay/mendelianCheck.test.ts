import PluginManager from '@jbrowse/core/PluginManager'
import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { resolveSubMenu } from '@jbrowse/core/ui'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { waitFor } from '@testing-library/react'
import { autorun } from 'mobx'

import { buildGenotypeMatrix } from '../VariantRPC/buildGenotypeMatrix.ts'
import { variantCellData } from '../VariantRPC/executeVariantCellData.ts'
import VariantsPlugin from '../index.ts'
import { cellFill } from '../shared/cellFill.ts'
import {
  genotypeMatrixArgs,
  genotypeMatrixKey,
} from '../shared/genotypeMatrixKey.ts'
import { runGenotypeClustering } from '../shared/runGenotypeClustering.ts'
import { MENDELIAN_FIELD } from '../shared/trios.ts'
import { getCachedABGR } from '../shared/variantWebglUtils.ts'
import { RECORDS_BAND_OFF, createTestEnvironment } from './testEnv.ts'

import type { GetGenotypeMatrixArgs } from '../VariantRPC/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const PARENTS = [{ name: 'dad' }, { name: 'mom' }]
const KID = { name: 'kid', father: 'dad', mother: 'mom', sex: 'male' }
const [DE_NOVO_COLOR] = UNIVERSAL_FIELD_PRESETS.mendelian.scale.range

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

// trio_x.vcf: x1 1/1 from 0/0 x 0/1, a Mendelian violation with no rule; x2 0/1
// from 0/0 x 0/0, a de novo candidate; x3 0/1 from 0/1 x 0/0, consistent
const TRIO_X_ADAPTER = {
  type: 'VcfAdapter',
  vcfLocation: {
    localPath: require.resolve('../VcfAdapter/test_data/trio_x.vcf'),
    locationType: 'LocalPathLocation',
  },
}
const TRIO_X_REGIONS = [
  { assemblyName: 'volvox', refName: 'NC_000023.11', start: 0, end: 1000 },
]

function variantsPluginManager() {
  const pluginManager = new PluginManager([new VariantsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

async function fetchedAs(props: Record<string, unknown>) {
  const result = await variantCellData({
    pluginManager: variantsPluginManager(),
    args: {
      sessionId: 'mendelianCheck',
      adapterConfig: TRIO_X_ADAPTER,
      regions: TRIO_X_REGIONS,
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
    getCachedABGR(cellFill(DE_NOVO_COLOR, 128)),
  )
  expect(display.paintedDomain).toEqual(
    expect.arrayContaining([
      'deNovoCandidate',
      'mendelianViolation',
      'consistent',
    ]),
  )
  dispose()
})

test('a filter entry on the check reaches the worker, which keeps the sites it names', async () => {
  const display = displayWith([
    { field: MENDELIAN_FIELD, equal: 'deNovoCandidate' },
  ])
  const props = display.rpcProps()
  const fetched = await fetchedAs(props)

  expect(props.filters).toBeUndefined()
  expect(props.mendelianFilter).toEqual([
    { field: MENDELIAN_FIELD, equal: 'deNovoCandidate' },
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
    {
      ...display.trios[0],
      childGenotype: '1/1',
      fatherGenotype: '0/0',
      motherGenotype: '0/1',
      call: 'consistent',
    },
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

describe('the genotype matrix under a filter on the check', () => {
  const FAILED = [
    {
      field: MENDELIAN_FIELD,
      oneOf: ['deNovoCandidate', 'mendelianViolation'],
    },
  ]

  async function sitesOf(args: GetGenotypeMatrixArgs) {
    const matrix = await buildGenotypeMatrix({
      pluginManager: variantsPluginManager(),
      args: { ...args, adapterConfig: TRIO_X_ADAPTER, sessionId: 'matrix' },
    })
    return [...matrix.values()].map(row => row.length)
  }

  test('the export and the clustering read the sites the screen shows', async () => {
    const display = displayWith(FAILED)
    const shown = (await fetchedAs(display.rpcProps())).simplifiedFeatures
    let clustered: GetGenotypeMatrixArgs | undefined
    await runGenotypeClustering({
      model: display,
      rpcManager: {
        call: (_sessionId, _method, args) => {
          clustered = args
          return Promise.resolve({ order: [0, 1, 2], tree: '(dad,kid,mom);' })
        },
      },
      sessionId: 'matrix',
      regions: TRIO_X_REGIONS,
      signal: new AbortController().signal,
      statusCallback: () => {},
    })

    expect(shown.map(f => f.data.name)).toEqual(['x1', 'x2'])
    expect(await sitesOf(genotypeMatrixArgs(display, TRIO_X_REGIONS))).toEqual([
      2, 2, 2,
    ])
    expect(clustered && (await sitesOf(clustered))).toEqual([2, 2, 2])
  })

  test('with no filter on the check every site enters and no trio is sent', async () => {
    const args = genotypeMatrixArgs(displayWith([]), TRIO_X_REGIONS)

    expect(args).not.toHaveProperty('trios')
    expect(await sitesOf(args)).toEqual([3, 3, 3])
  })

  test('the filter keys the exported matrix', () => {
    const before = JSON.stringify(genotypeMatrixKey(displayWith([])))

    expect(JSON.stringify(genotypeMatrixKey(displayWith(FAILED)))).not.toBe(
      before,
    )
  })
})

describe('the Filter by menu’s Mendelian check', () => {
  type Display = ReturnType<typeof displayWith>

  function subMenuOf(items: MenuItem[], label: string) {
    const item = items.find(
      i =>
        'label' in i &&
        typeof i.label === 'string' &&
        i.label.startsWith(label),
    )
    return item && 'subMenu' in item
      ? { item, rows: resolveSubMenu(item) }
      : undefined
  }

  function mendelianMenu(display: Display) {
    const filterBy = subMenuOf(display.trackMenuItems(), 'Filter by')
    return subMenuOf(filterBy?.rows ?? [], 'Mendelian check')
  }

  function toggle(display: Display, label: string) {
    const row = mendelianMenu(display)?.rows.find(
      i => 'label' in i && i.label === label,
    )
    if (row?.type !== 'checkbox') {
      throw new Error(`no checkbox row labelled ${label}`)
    }
    row.onClick()
  }

  const checked = (display: Display) =>
    mendelianMenu(display)?.rows.flatMap(i =>
      i.type === 'checkbox' && i.checked ? [i.label] : [],
    )

  test('checking values writes one entry the worker is sent, and unchecking all removes it', () => {
    const maf = { field: 'minorAlleleFrequency', gte: 0.05 }
    const display = displayWith([maf])

    toggle(display, 'De novo candidate')
    toggle(display, 'Mendelian violation')

    const entry = {
      field: MENDELIAN_FIELD,
      oneOf: ['deNovoCandidate', 'mendelianViolation'],
    }
    expect(predicatesOf(display.configuration.filter)).toEqual([maf, entry])
    expect(display.rpcProps().mendelianFilter).toEqual([entry])
    expect(checked(display)).toEqual([
      'De novo candidate',
      'Mendelian violation',
    ])

    toggle(display, 'De novo candidate')
    toggle(display, 'Mendelian violation')

    expect(predicatesOf(display.configuration.filter)).toEqual([maf])
    expect(display.rpcProps().mendelianFilter).toEqual([])
    expect(checked(display)).toEqual([])
  })

  test('a config’s `equal` entry reads as its value checked', () => {
    const display = displayWith([
      { field: MENDELIAN_FIELD, equal: 'deNovoCandidate' },
    ])

    expect(checked(display)).toEqual(['De novo candidate'])
  })

  test('a track with no trio sends no filter on the check, so no site is dropped', () => {
    const display = displayWith([
      { field: MENDELIAN_FIELD, oneOf: ['deNovoCandidate'] },
    ])
    display.setSources([{ name: 'kid' }, ...PARENTS])

    expect(display.rpcProps().mendelianFilter).toEqual([])
    expect(JSON.stringify(genotypeMatrixKey(display))).not.toContain(
      MENDELIAN_FIELD,
    )
  })

  test('a track with no trio greys it with the reason', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources([{ name: 'kid' }, ...PARENTS])

    expect(mendelianMenu(display)?.item).toMatchObject({
      label: 'Mendelian check (no sample has a parent among the samples)',
      disabled: true,
    })
  })
})
