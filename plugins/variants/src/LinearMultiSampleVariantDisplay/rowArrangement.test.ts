import { createTestEnvironment } from './testEnv.ts'

// Sample metadata as samplesTsv supplies it: `population` is what "Color by…"
// and "Group by…" key on.
const SOURCES = [
  { name: 'S0', population: 'AFR' },
  { name: 'S1', population: 'EUR' },
  { name: 'S2', population: 'AFR' },
]

// A clustering run's output: rows in tree-leaf order, plus the newick whose
// leaves are those same names in that same order (hclust's `order` is exactly
// `toNewick`'s leaf order, which is what makes leaf i land on row i).
const CLUSTERED = [{ name: 'S2' }, { name: 'S0' }, { name: 'S1' }]
const CLUSTERED_TREE = '((S2,S0),S1);'

function clusteredDisplay() {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(SOURCES)
  display.setLayoutAndClusterTree(CLUSTERED, CLUSTERED_TREE)
  return display
}

function rowNames(display: { sources: { name: string }[] }) {
  return display.sources.map(s => s.name)
}

describe('recoloring does not disturb the arrangement', () => {
  it('keeps a clustered order and its tree when coloring by a sample attribute', () => {
    const display = clusteredDisplay()
    display.setColorBy('population')

    expect(rowNames(display)).toEqual(['S2', 'S0', 'S1'])
    expect(display.clusterTree).toBe(CLUSTERED_TREE)
    // the dendrogram still positions, i.e. its leaves are still these rows
    expect(display.hierarchy).toBeDefined()
    expect(display.sources.every(s => s.labelColor)).toBe(true)
  })

  it('clearing the coloring strips the palette without resetting the order', () => {
    const display = clusteredDisplay()
    display.setColorBy('population')
    display.setColorBy('')

    expect(rowNames(display)).toEqual(['S2', 'S0', 'S1'])
    expect(display.clusterTree).toBe(CLUSTERED_TREE)
    expect(display.sources.some(s => s.labelColor)).toBe(false)
  })

  // Rows are haplotypes after a phased clustering run, while `sourcesVolatile`
  // is still sample-level — re-deriving from it halved the row count.
  it('keeps the haplotype rows in phased mode', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setPhasedMode('phased')
    display.setSources(SOURCES)
    const haplotypes = ['S2', 'S0', 'S1'].flatMap(sampleName => [
      { name: `${sampleName} HP0`, sampleName, HP: 0 },
      { name: `${sampleName} HP1`, sampleName, HP: 1 },
    ])
    display.setLayoutAndClusterTree(
      haplotypes,
      '(((S2 HP0,S2 HP1),(S0 HP0,S0 HP1)),(S1 HP0,S1 HP1));',
    )

    display.setColorBy('population')

    expect(rowNames(display)).toEqual(haplotypes.map(s => s.name))
    expect(display.hierarchy).toBeDefined()
  })
})

describe('regrouping invalidates the tree it reorders under', () => {
  // `setLayout` decides from the rows, not from which action ran: a grouping
  // that lands on the order the tree already describes keeps it.
  it('keeps the tree when the grouping agrees with the clustered order', () => {
    const display = clusteredDisplay()
    display.setGroupBy('population')

    // AFR (S2, S0) leads EUR (S1) by size, which is the clustered order already
    expect(rowNames(display)).toEqual(['S2', 'S0', 'S1'])
    expect(display.groupBy).toBe('population')
    expect(display.clusterTree).toBe(CLUSTERED_TREE)
  })

  it('drops the cluster tree when the grouping order differs from it', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources(SOURCES)
    // clustered in adapter order, which grouping will not preserve
    display.setLayoutAndClusterTree(
      [{ name: 'S0' }, { name: 'S1' }, { name: 'S2' }],
      '((S0,S1),S2);',
    )

    display.setGroupBy('population')

    expect(rowNames(display)).toEqual(['S0', 'S2', 'S1'])
    expect(display.clusterTree).toBeUndefined()
    expect(display.hierarchy).toBeUndefined()
  })
})

describe('a rendering-mode switch renames the rows', () => {
  // The filter holds tree *leaf* names, and the mode decides whether those are
  // sample names or "S0 HP0" haplotype names. Left behind it matched nothing
  // and the display went blank.
  it('clears the subtree filter along with the layout and tree', () => {
    const display = clusteredDisplay()
    display.setSubtreeFilter(['S2', 'S0'])
    expect(rowNames(display)).toEqual(['S2', 'S0'])

    display.setPhasedMode('phased')

    expect(display.subtreeFilter).toBeUndefined()
    expect(display.layout).toEqual([])
    expect(display.clusterTree).toBeUndefined()
    expect(rowNames(display)).toEqual(['S0', 'S1', 'S2'])
  })

  // Clearing without re-arranging dropped the configured coloring on every
  // mode switch, while "Color by… → Population" stayed checked in the menu.
  it('re-applies the configured coloring to the renamed rows', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources(SOURCES)
    display.setColorBy('population')

    display.setPhasedMode('phased')

    expect(display.colorBy).toBe('population')
    expect(display.sources.every(s => s.labelColor)).toBe(true)
    const byName = Object.fromEntries(
      display.layout.map(s => [s.name, s.labelColor]),
    )
    expect(byName.S0).toBe(byName.S2)
    expect(byName.S0).not.toBe(byName.S1)
  })

  it('leaves everything alone when the mode does not change', () => {
    const display = clusteredDisplay()
    display.setSubtreeFilter(['S2', 'S0'])

    display.setPhasedMode(display.renderingMode)

    expect(display.subtreeFilter?.slice()).toEqual(['S2', 'S0'])
    expect(display.clusterTree).toBe(CLUSTERED_TREE)
  })

  // A reorder is not a rename: the filter still names rows that exist, so the
  // user's focused clade survives a "Sort by genotype" or a dialog reorder.
  it('survives a reorder that invalidates the tree', () => {
    const display = clusteredDisplay()
    display.setSubtreeFilter(['S2', 'S0'])

    display.setLayout([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])

    expect(display.clusterTree).toBeUndefined()
    expect(display.subtreeFilter?.slice()).toEqual(['S2', 'S0'])
    expect(rowNames(display)).toEqual(['S0', 'S2'])
  })
})

describe('an adapter swap to a new cohort', () => {
  // A layout none of whose rows name a current sample is a previous dataset's:
  // getSources drops every stale row and a subtreeFilter keyed on the old names
  // matches nothing, so left standing they drew a blank display with colorBy
  // still ticked in the menu.
  it('resets a stale arrangement, its tree and its subtree filter', () => {
    const display = clusteredDisplay()
    display.setSubtreeFilter(['S2', 'S0'])
    display.setColorBy('population')

    const cohortB = [
      { name: 'T0', population: 'EAS' },
      { name: 'T1', population: 'SAS' },
    ]
    display.setSources(cohortB)

    expect(display.subtreeFilter).toBeUndefined()
    expect(display.clusterTree).toBeUndefined()
    expect(rowNames(display)).toEqual(['T0', 'T1'])
    // the configured coloring is re-seeded against the new cohort
    expect(display.sources.every(s => s.labelColor)).toBe(true)
  })

  it('keeps the arrangement when the cohorts overlap', () => {
    const display = clusteredDisplay()

    display.setSources([...SOURCES, { name: 'S3', population: 'EUR' }])

    expect(display.clusterTree).toBe(CLUSTERED_TREE)
    // the layout keeps its order and the new sample appends
    expect(rowNames(display)).toEqual(['S2', 'S0', 'S1', 'S3'])
  })
})

// The interned payload one variant's worth of genotypes reaches the model as:
// codes are 1-based indices into `genotypeDict`, aligned to `sampleNames`.
// Matrix mode rather than regular because its shape is the flat one — the sort
// reads both through `getOrderedGenotypeCodes`.
const ONE_VARIANT = {
  mode: 'matrix',
  simplifiedFeatures: [{ id: 'v1' }],
  featureData: [
    { featureId: 'v1', genotypeCodes: Uint32Array.from([1, 2, 3]) },
  ],
  sampleNames: ['S0', 'S1', 'S2'],
  genotypeDict: ['0/0', '0/1', '1/1'],
}

describe('sorting by genotype keeps what the arrangement put on the rows', () => {
  function sortableDisplay() {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources(SOURCES)
    display.setCellData(
      ONE_VARIANT as unknown as Parameters<typeof display.setCellData>[0],
    )
    return display
  }

  // The sort is the only writer of `layout` that computed a fresh order without
  // merging it back, so the palette "Color by…" had just written went with it:
  // the rows reordered correctly and every sidebar swatch went blank, while the
  // menu still showed Population ticked. Nothing re-seeds it afterwards.
  it('keeps the colorBy palette through a sort', () => {
    const display = sortableDisplay()
    display.setColorBy('population')
    const before = new Map(display.sources.map(s => [s.name, s.labelColor]))
    expect([...before.values()].every(Boolean)).toBe(true)

    display.sortByGenotype('v1')

    // hom-alt leads, no-call last — so the order really did change
    expect(rowNames(display)).toEqual(['S2', 'S1', 'S0'])
    expect(display.sources.every(s => s.labelColor)).toBe(true)
    // ...and each row kept ITS colour, not merely some colour
    for (const s of display.sources) {
      expect(s.labelColor).toBe(before.get(s.name))
    }
  })

  // In phased mode the sorted rows are haplotypes and `layout` is sample-level,
  // so a merge by name matched nothing and dropped every colour — the same
  // failure as above, in the mode neither test above runs in.
  it('keeps the colorBy palette through a sort in phased mode', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setPhasedMode('phased')
    display.setSources(SOURCES)
    display.setCellData({
      ...ONE_VARIANT,
      sampleInfo: {
        S0: { maxPloidy: 2 },
        S1: { maxPloidy: 2 },
        S2: { maxPloidy: 2 },
      },
    } as unknown as Parameters<typeof display.setCellData>[0])
    display.setColorBy('population')
    const before = new Map(display.sources.map(s => [s.name, s.labelColor]))
    expect(display.sources).toHaveLength(6)
    expect([...before.values()].every(Boolean)).toBe(true)

    display.sortByGenotype('v1')

    expect(display.sources).toHaveLength(6)
    expect(display.sources.every(s => s.labelColor)).toBe(true)
    for (const s of display.sources) {
      expect(s.labelColor).toBe(before.get(s.name))
    }
  })

  // Same rule, for the overrides the arrangement dialog writes rather than a
  // palette. These have no other home than `layout` either.
  it('keeps a hand-set label and labelColor through a sort', () => {
    const display = sortableDisplay()
    display.setLayout([
      { name: 'S0', label: 'first', labelColor: 'red' },
      { name: 'S1' },
      { name: 'S2' },
    ])

    display.sortByGenotype('v1')

    expect(rowNames(display)).toEqual(['S2', 'S1', 'S0'])
    expect(display.sources.find(s => s.name === 'S0')).toMatchObject({
      label: 'first',
      labelColor: 'red',
    })
  })
})
