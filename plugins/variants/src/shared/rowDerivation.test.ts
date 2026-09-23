import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'
import { runGenotypeClustering } from './runGenotypeClustering.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../LinearMultiSampleVariantDisplay/model.ts'
import type { ProcessedSource } from './types.ts'

type Display = LinearMultiSampleVariantDisplayModel

// Sample metadata as a samplesTsv supplies it: `population` bands and tints,
// and a `color` or `label` column is the row's own.
const SOURCES = [
  { name: 'S0', population: 'AFR', color: '#aa0000', label: 'Sample zero' },
  { name: 'S1', population: 'EUR' },
  { name: 'S2', population: 'AFR', color: '#00aa00' },
  { name: 'S3', population: 'EAS', label: 'Sample three' },
]

// S3 is haploid, so phased mode gives it one row.
const SAMPLE_INFO = {
  S0: { isPhased: true, maxPloidy: 2 },
  S1: { isPhased: true, maxPloidy: 2 },
  S2: { isPhased: true, maxPloidy: 2 },
  S3: { isPhased: true, maxPloidy: 1 },
}

const GENOTYPES = {
  v500: ['0|1', '1|1', '0|0', '1'],
  v700: ['1|0', '0|0', '1|1', '0'],
}

const REGIONS = [
  { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
]

interface Arrangement {
  domain?: string[]
  rowColor?: string
  facet?: string
}

// The arrangement settings, spelled once: the derivation pinned below is what
// has to survive their move into the `rows` and `rowColor` objects, so this
// helper is all of the file that move may change.
function arrangementConfig({ domain, rowColor, facet }: Arrangement) {
  return {
    ...(domain ? { rows: { domain } } : {}),
    ...(rowColor ? { rowColor } : {}),
    ...(facet ? { facet } : {}),
  }
}

function loaded({
  phased,
  ...arrangement
}: Arrangement & { phased?: boolean } = {}) {
  const { display } = createTestEnvironment({
    displayConfig: {
      ...arrangementConfig(arrangement),
      ...(phased ? { renderingMode: 'phased' } : {}),
    },
  }).createDisplay()
  display.setSources(SOURCES)
  return display
}

function landCells(display: Display) {
  const genotypeDict = [...new Set(Object.values(GENOTYPES).flat())]
  const codes = (gts: string[]) =>
    new Uint32Array(gts.map(g => genotypeDict.indexOf(g) + 1))
  display.setCellData({
    mode: 'regular',
    sampleNames: SOURCES.map(s => s.name),
    genotypeDict,
    sampleInfo: SAMPLE_INFO,
    rowNames: [],
    simplifiedFeatures: Object.keys(GENOTYPES).map(id => ({
      id,
      data: { start: Number(id.slice(1)), end: Number(id.slice(1)) + 1 },
    })),
    perRegionCellData: {
      0: {
        featureGenotypeMap: Object.fromEntries(
          Object.entries(GENOTYPES).map(([id, gts]) => [
            id,
            { genotypeCodes: codes(gts) },
          ]),
        ),
      },
    },
  } as unknown as Parameters<Display['setCellData']>[0])
}

async function cluster(display: Display, order: number[], tree: string) {
  await runGenotypeClustering({
    model: display,
    rpcManager: { call: async () => ({ order, tree }) },
    sessionId: 'session',
    regions: REGIONS,
    signal: new AbortController().signal,
    statusCallback: () => {},
  })
}

function row({
  name,
  label,
  labelColor,
  color,
  sampleName,
  HP,
  population,
}: ProcessedSource) {
  return { name, label, labelColor, color, sampleName, HP, population }
}

function derived(display: Display) {
  return {
    sources: display.sources.map(row),
    editableSources: display.editableSources.map(row),
    sampleFilter: display.sampleFilter,
    rowTree: display.rowTree,
    treeDrawn: display.hierarchy !== undefined,
    rowArrangementIsCustom: display.rowArrangementIsCustom,
    groupLegend: display.colorScales.find(s => s.id === 'group'),
  }
}

const names = (display: Display) => display.sources.map(s => s.name)

describe('allele count', () => {
  test('samplesTsv colours and labels are the rows own', () => {
    expect(derived(loaded())).toMatchSnapshot()
  })

  test('a rowColor attribute tints every row over its own colour', () => {
    expect(derived(loaded({ rowColor: 'population' }))).toMatchSnapshot()
  })

  test('a facet bands the rows', () => {
    expect(derived(loaded({ facet: 'population' }))).toMatchSnapshot()
  })

  test('a declared order leads and a facet bands within it', () => {
    expect(derived(loaded({ domain: ['S3', 'S1'] }))).toMatchSnapshot()
    expect(
      derived(loaded({ domain: ['S3', 'S1'], facet: 'population' })),
    ).toMatchSnapshot()
  })

  test('a focus narrows the rows and the fetch', () => {
    const display = loaded({ rowColor: 'population' })
    display.setRowFocus(['S2', 'S0'])
    expect(derived(display)).toMatchSnapshot()
    display.setRowFocus(undefined)
    display.focusGroup('EUR')
    expect(derived(display)).toMatchSnapshot()
  })

  test('dialog edits relabel, recolour and reorder, and a reset returns', () => {
    const display = loaded()
    const [s0, s1, s2, s3] = display.editableSources
    display.applyRowEdits([
      { ...s2!, label: 'Two' },
      s0!,
      { ...s3!, labelColor: '#123456' },
      { ...s1!, labelColor: '#654321' },
    ])
    expect(derived(display)).toMatchSnapshot()
    display.resetRowArrangement()
    expect(derived(display)).toMatchSnapshot()
  })

  test('the rowColor palette wins over a dialog colour until cleared', () => {
    const display = loaded({ rowColor: 'population' })
    const [s0, s1, ...rest] = display.editableSources
    display.applyRowEdits([s0!, { ...s1!, labelColor: '#123456' }, ...rest])
    expect(derived(display)).toMatchSnapshot()
    display.setRowColor('')
    expect(derived(display)).toMatchSnapshot()
  })

  test('a cluster run lands its order and tree, and a facet yields to it', async () => {
    const display = loaded({ rowColor: 'population' })
    landCells(display)
    await cluster(display, [2, 0, 3, 1], '((S2,S0),(S3,S1));')
    expect(derived(display)).toMatchSnapshot()
    display.setFacet('population')
    expect(derived(display)).toMatchSnapshot()
  })

  test('a cluster run rotates towards the declared order', async () => {
    const display = loaded({ domain: ['S3'] })
    landCells(display)
    await cluster(display, [2, 0, 3, 1], '((S2,S0),(S3,S1));')
    expect(derived(display)).toMatchSnapshot()
  })

  test('a focused cluster run keeps the hidden rows after the clade', async () => {
    const display = loaded({ domain: ['S3', 'S1'] })
    display.setRowFocus(['S0', 'S1', 'S2'])
    landCells(display)
    await cluster(display, [2, 0, 1], '((S2,S0),S1);')
    expect(derived(display)).toMatchSnapshot()
    display.setRowFocus(undefined)
    expect(derived(display)).toMatchSnapshot()
  })

  test('sort by genotype orders the rows at a variant', () => {
    const display = loaded({ rowColor: 'population' })
    landCells(display)
    display.sortByGenotype('v500')
    expect(derived(display)).toMatchSnapshot()
  })

  test('a switch to phased mode resets the arrangement', async () => {
    const display = loaded({ domain: ['S3'] })
    const [s3, s0, s1, s2] = display.editableSources
    display.applyRowEdits([s0!, { ...s1!, label: 'One' }, s2!, s3!])
    landCells(display)
    await cluster(display, [2, 0, 3, 1], '((S2,S0),(S3,S1));')
    display.setPhasedMode('phased')
    expect(derived(display)).toMatchSnapshot()
    landCells(display)
    expect(derived(display)).toMatchSnapshot()
  })
})

describe('phased', () => {
  test('sample rows until the ploidy lands, then haplotypes', () => {
    const display = loaded({ phased: true, rowColor: 'population' })
    expect(derived(display)).toMatchSnapshot()
    landCells(display)
    expect(derived(display)).toMatchSnapshot()
  })

  test('a declared sample order and a facet over the haplotypes', () => {
    const display = loaded({
      phased: true,
      domain: ['S3', 'S1'],
      facet: 'population',
    })
    landCells(display)
    expect(derived(display)).toMatchSnapshot()
  })

  test('a legend focus keeps whole samples', () => {
    const display = loaded({ phased: true, rowColor: 'population' })
    landCells(display)
    display.focusGroup('AFR')
    expect(derived(display)).toMatchSnapshot()
    landCells(display)
    expect(derived(display)).toMatchSnapshot()
  })

  test('dialog edits at haplotype granularity', () => {
    const display = loaded({ phased: true })
    landCells(display)
    const [h0, h1, h2, h3, h4, h5, h6] = display.editableSources
    display.applyRowEdits([
      h6!,
      { ...h1!, label: 'Zero, second' },
      h0!,
      { ...h4!, labelColor: '#123456' },
      h2!,
      h3!,
      h5!,
    ])
    expect(derived(display)).toMatchSnapshot()
    display.resetRowArrangement()
    expect(derived(display)).toMatchSnapshot()
  })

  test('sort by genotype orders haplotypes', () => {
    const display = loaded({ phased: true })
    landCells(display)
    display.sortByGenotype('v700')
    expect(derived(display)).toMatchSnapshot()
  })

  describe('after a cluster run lands haplotype rows', () => {
    async function clustered() {
      const display = loaded({ phased: true, rowColor: 'population' })
      landCells(display)
      await cluster(
        display,
        [4, 5, 0, 1, 6, 2, 3],
        '(((S2 HP0,S2 HP1),(S0 HP0,S0 HP1)),(S3 HP0,(S1 HP0,S1 HP1)));',
      )
      return display
    }

    test('the tree describes the haplotype rows', async () => {
      const display = await clustered()
      expect(derived(display)).toMatchSnapshot()
      display.setFacet('population')
      expect(derived(display)).toMatchSnapshot()
    })

    test('a clade focus', async () => {
      const display = await clustered()
      display.setRowFocus(['S2 HP0', 'S2 HP1', 'S0 HP0', 'S0 HP1'])
      expect(derived(display)).toMatchSnapshot()
      landCells(display)
      expect(derived(display)).toMatchSnapshot()
    })

    test('a focus on one haplotype of one sample still fetches the sample', async () => {
      const display = await clustered()
      display.setRowFocus(['S1 HP0'])
      expect(display.sampleFilter).toEqual(['S1'])
      expect(derived(display)).toMatchSnapshot()
      landCells(display)
      expect(names(display)).toEqual(['S1 HP0'])
      expect(derived(display)).toMatchSnapshot()
    })

    test('a switch back to allele count resets', async () => {
      const display = await clustered()
      display.setPhasedMode('alleleCount')
      expect(derived(display)).toMatchSnapshot()
    })
  })
})
