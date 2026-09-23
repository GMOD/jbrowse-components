import { createTestEnvironment } from './testEnv.ts'

// Sample metadata as samplesTsv supplies it: `population` is what "Color by…"
// and "Group rows by…" key on.
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
  display.setRowOrder(CLUSTERED, { tree: CLUSTERED_TREE })
  return display
}

function rowNames(display: { sources: { name: string }[] }) {
  return display.sources.map(s => s.name)
}

describe('recoloring does not disturb the arrangement', () => {
  it('keeps a clustered order and its tree when coloring by a sample attribute', () => {
    const display = clusteredDisplay()
    display.setRowColor('population')

    expect(rowNames(display)).toEqual(['S2', 'S0', 'S1'])
    expect(display.rowTree).toBe(CLUSTERED_TREE)
    // the dendrogram still positions, i.e. its leaves are still these rows
    expect(display.hierarchy).toBeDefined()
    expect(display.sources.every(s => s.labelColor)).toBe(true)
  })

  it('clearing the coloring strips the palette without resetting the order', () => {
    const display = clusteredDisplay()
    display.setRowColor('population')
    display.setRowColor('')

    expect(rowNames(display)).toEqual(['S2', 'S0', 'S1'])
    expect(display.rowTree).toBe(CLUSTERED_TREE)
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
    display.setRowOrder(haplotypes, {
      tree: '(((S2 HP0,S2 HP1),(S0 HP0,S0 HP1)),(S1 HP0,S1 HP1));',
    })

    display.setRowColor('population')

    expect(rowNames(display)).toEqual(haplotypes.map(s => s.name))
    expect(display.hierarchy).toBeDefined()
  })
})

describe('the facet bands over the arranged order', () => {
  it('bands the rows a drag left behind', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources(SOURCES)
    display.setRowOrder([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])
    display.setFacet('population')

    // AFR (S0, S2) leads; within the band the dragged order survives
    expect(rowNames(display)).toEqual(['S0', 'S2', 'S1'])
  })

  // The band is resolved on the read, over whatever `rows.domain` holds, so a drag
  // that moves a sample into another band has nowhere to land.
  it('snaps a cross-band drag back', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources(SOURCES)
    display.setFacet('population')
    expect(rowNames(display)).toEqual(['S0', 'S2', 'S1'])

    // drag the EUR sample to the top, across the AFR band
    display.setRowOrder([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])

    expect(rowNames(display)).toEqual(['S0', 'S2', 'S1'])
    expect(display.rowDomain).toEqual(['S1', 'S0', 'S2'])
  })

  // A dendrogram positions leaf i on row i, so a band under it would draw it
  // against the wrong rows. The band yields instead — which is also why a
  // clustering run never has to write the facet slot.
  it('yields while a cluster tree describes the rows', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources(SOURCES)
    // clustered in adapter order, which the facet would not preserve
    display.setRowOrder([{ name: 'S0' }, { name: 'S1' }, { name: 'S2' }], {
      tree: '((S0,S1),S2);',
    })

    display.setFacet('population')

    expect(rowNames(display)).toEqual(['S0', 'S1', 'S2'])
    expect(display.facet?.field).toBe('population')
    expect(display.rowTree).toBe('((S0,S1),S2);')
    expect(display.hierarchy).toBeDefined()
  })

  // ...and it comes back the moment the tree stops describing them.
  it('bands again once the rows move off the tree', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources(SOURCES)
    display.setRowOrder([{ name: 'S0' }, { name: 'S1' }, { name: 'S2' }], {
      tree: '((S0,S1),S2);',
    })
    display.setFacet('population')

    display.setRowOrder([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])

    expect(display.rowTree).toBeUndefined()
    expect(rowNames(display)).toEqual(['S0', 'S2', 'S1'])
  })

  // A phased run's order names haplotype rows, and expansion spreads every source
  // field onto each one — so the attribute the band reads is there.
  it('bands the haplotype rows a phased run produced', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setPhasedMode('phased')
    display.setSources(SOURCES)
    display.setCellData({
      sampleInfo: Object.fromEntries(
        SOURCES.map(s => [s.name, { maxPloidy: 2 }]),
      ),
    } as unknown as Parameters<typeof display.setCellData>[0])
    display.setRowOrder(
      ['S0', 'S1', 'S2'].flatMap(sampleName => [
        { name: `${sampleName} HP0`, sampleName, HP: 0 },
        { name: `${sampleName} HP1`, sampleName, HP: 1 },
      ]),
    )

    display.setFacet('population')

    expect(rowNames(display)).toEqual([
      'S0 HP0',
      'S0 HP1',
      'S2 HP0',
      'S2 HP1',
      'S1 HP0',
      'S1 HP1',
    ])
  })
})

describe('the config `domain` seeds the sample order', () => {
  function domainDisplay(domain: string[]) {
    const { display } = createTestEnvironment({
      displayConfig: { rows: { domain } },
    }).createDisplay()
    display.setSources(SOURCES)
    return display
  }

  it('leads with the samples it names and leaves the rest in file order', () => {
    expect(rowNames(domainDisplay(['S2']))).toEqual(['S2', 'S0', 'S1'])
  })

  it('ignores a sample the file does not have', () => {
    expect(rowNames(domainDisplay(['T9', 'S1']))).toEqual(['S1', 'S0', 'S2'])
  })

  // The facet bands within the seeded order rather than against it: AFR (S0,
  // S2) before EUR (S1), and S2 leads its band because the domain put it there.
  it('bands a facet within it', () => {
    const display = domainDisplay(['S2'])
    display.setFacet('population')

    expect(rowNames(display)).toEqual(['S2', 'S0', 'S1'])
  })

  // The seed is the config's own `rows.domain`, so a track nobody has touched
  // is not offered "Reset row order".
  it('is not a custom row order', () => {
    const display = domainDisplay(['S2'])
    expect(display.rowDomain).toEqual(['S2'])
    expect(display.rowArrangementIsCustom).toBe(false)
  })

  it('offers the reset once the rows move off it, and returns to it', () => {
    const display = domainDisplay(['S2'])
    display.setRowOrder([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])
    expect(display.rowArrangementIsCustom).toBe(true)

    display.resetRowArrangement()

    expect(rowNames(display)).toEqual(['S2', 'S0', 'S1'])
    expect(display.rowArrangementIsCustom).toBe(false)
  })

  // The seed is applied once, to the adapter order. A recolor or a refacet
  // re-arranges the rows on screen, and re-seeding there would move S2 back
  // to the front over a drag and, over a clustering run, drop the tree.
  it('does not re-seed a dragged order on a recolor', () => {
    const display = domainDisplay(['S2'])
    display.setRowOrder([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])
    display.setRowColor('population')

    expect(rowNames(display)).toEqual(['S1', 'S0', 'S2'])
    expect(display.rowArrangementIsCustom).toBe(true)
  })

  it('keeps a clustered order and its tree on a recolor', () => {
    const display = domainDisplay(['S2'])
    const clustered = [{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }]
    const tree = '((S1,S0),S2);'
    display.setRowOrder(clustered, { tree })
    display.setRowColor('population')

    expect(rowNames(display)).toEqual(['S1', 'S0', 'S2'])
    expect(display.rowTree).toBe(tree)
    expect(display.hierarchy).toBeDefined()
  })

  it('bands a facet within a dragged order rather than the seed', () => {
    const display = domainDisplay(['S2'])
    display.setRowOrder([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])
    display.setFacet('population')

    expect(rowNames(display)).toEqual(['S0', 'S2', 'S1'])
  })
})

describe('a rendering-mode switch renames the rows', () => {
  // The filter holds tree *leaf* names, and the mode decides whether those are
  // sample names or "S0 HP0" haplotype names. Left behind it matched nothing
  // and the display went blank.
  it('clears the focus along with the order and tree', () => {
    const display = clusteredDisplay()
    display.setRowFocus(['S2', 'S0'])
    expect(rowNames(display)).toEqual(['S2', 'S0'])

    display.setPhasedMode('phased')

    expect(display.rowFocus).toBeUndefined()
    expect(display.rowDomain).toEqual([])
    expect(display.rowTree).toBeUndefined()
    expect(rowNames(display)).toEqual(['S0', 'S1', 'S2'])
  })

  // The coloring is resolved on the read, so the renamed rows arrive already
  // tinted.
  it('keeps the configured coloring on the renamed rows', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources(SOURCES)
    display.setRowColor('population')

    display.setPhasedMode('phased')

    expect(display.rowColor).toBe('population')
    expect(display.sources.every(s => s.labelColor)).toBe(true)
    const byName = Object.fromEntries(
      display.sources.map(s => [s.name, s.labelColor]),
    )
    expect(byName.S0).toBe(byName.S2)
    expect(byName.S0).not.toBe(byName.S1)
  })

  it('leaves everything alone when the mode does not change', () => {
    const display = clusteredDisplay()
    display.setRowFocus(['S2', 'S0'])

    display.setPhasedMode(display.renderingMode)

    expect(display.rowFocus?.slice()).toEqual(['S2', 'S0'])
    expect(display.rowTree).toBe(CLUSTERED_TREE)
  })

  // A reorder is not a rename: the filter still names rows that exist, so the
  // user's focused clade survives a "Sort by genotype" or a dialog reorder.
  it('survives a reorder that invalidates the tree', () => {
    const display = clusteredDisplay()
    display.setRowFocus(['S2', 'S0'])

    display.setRowOrder([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])

    expect(display.rowTree).toBeUndefined()
    expect(display.rowFocus?.slice()).toEqual(['S2', 'S0'])
    expect(rowNames(display)).toEqual(['S0', 'S2'])
  })
})

describe('an adapter swap to a new cohort', () => {
  // An order none of whose names is a current sample is a previous dataset's,
  // and the tree beside it names rows that are gone.
  it('resets a stale arrangement, its tree and its subtree filter', () => {
    const display = clusteredDisplay()
    display.setRowFocus(['S2', 'S0'])
    display.setRowColor('population')

    const cohortB = [
      { name: 'T0', population: 'EAS' },
      { name: 'T1', population: 'SAS' },
    ]
    display.setSources(cohortB)

    expect(display.rowFocus).toBeUndefined()
    expect(display.rowTree).toBeUndefined()
    expect(rowNames(display)).toEqual(['T0', 'T1'])
    // the configured coloring is re-seeded against the new cohort
    expect(display.sources.every(s => s.labelColor)).toBe(true)
  })

  it('keeps the arrangement when the cohorts overlap', () => {
    const display = clusteredDisplay()

    display.setSources([...SOURCES, { name: 'S3', population: 'EUR' }])

    expect(display.rowTree).toBe(CLUSTERED_TREE)
    // the order keeps and the new sample appends
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

  // The sort computes a fresh order, and the palette "Color by…" had just
  // written once went with it: the rows reordered correctly and every sidebar
  // swatch went blank, while the menu still showed Population ticked.
  it('keeps the colorBy palette through a sort', () => {
    const display = sortableDisplay()
    display.setRowColor('population')
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

  // In phased mode the sorted rows are haplotypes — the same failure as above,
  // in the mode neither test above runs in.
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
    display.setRowColor('population')
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
  // palette: `rows.labels` and `rowColor` hold them by name, so they follow the
  // row.
  it('keeps a hand-set label and labelColor through a sort', () => {
    const display = sortableDisplay()
    const [s0, s1, s2] = display.editableSources
    display.applyRowEdits([
      { ...s0!, label: 'first', labelColor: 'red' },
      s1!,
      s2!,
    ])

    display.sortByGenotype('v1')

    expect(rowNames(display)).toEqual(['S2', 'S1', 'S0'])
    expect(display.sources.find(s => s.name === 'S0')).toMatchObject({
      label: 'first',
      labelColor: 'red',
    })
  })
})
