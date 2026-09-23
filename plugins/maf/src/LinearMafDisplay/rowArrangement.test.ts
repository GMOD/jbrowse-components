import { getConf, setConf } from '@jbrowse/core/configuration'

import { createMafTestEnvironment } from './testEnv.ts'

const TREE = '((hg38,panTro4),mm10);'

function sample(id: string) {
  return { id, label: id }
}

function rowNames(display: { sources?: { name: string }[] }) {
  return display.sources?.map(s => s.name)
}

describe('a discovered row set widens under a custom arrangement', () => {
  // A sample-discovery track learns of a genome only from the region whose
  // blocks contain it, so the row set grows as the user scrolls. `rows.domain`
  // is an ordering hint, never the row set, so a species revealed by a later
  // region still gets a row.
  it('gives a newly discovered species a row after a reorder', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setSamples({
      samples: [sample('hg38'), sample('panTro4')],
      treeNewick: undefined,
      samplesCanonical: false,
    })
    display.setRowOrder([{ name: 'panTro4' }, { name: 'hg38' }])

    display.setSamples({
      samples: [sample('mm10')],
      treeNewick: undefined,
      samplesCanonical: false,
    })

    expect(rowNames(display)).toEqual(['panTro4', 'hg38', 'mm10'])
  })

  // The other half of the union: a region that re-reports a species the display
  // already knows supplies the newer label/color without moving the row. Adapter
  // configs carry a per-sample color, and a discovery track can meet the same
  // species again in a later region — first-seen order is what keeps the rows
  // from reshuffling under the user while that happens.
  it('takes the newer label and color without reordering', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setSamples({
      samples: [sample('hg38'), sample('panTro4')],
      treeNewick: undefined,
      samplesCanonical: false,
    })
    display.setSamples({
      samples: [{ id: 'panTro4', label: 'Chimp', color: 'red' }],
      treeNewick: undefined,
      samplesCanonical: false,
    })

    expect(rowNames(display)).toEqual(['hg38', 'panTro4'])
    expect(display.sources[1]).toMatchObject({
      name: 'panTro4',
      label: 'Chimp',
      labelColor: 'red',
    })
  })

  it('drops an ordered row the data no longer has', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setSamples({
      samples: [sample('hg38'), sample('panTro4')],
      treeNewick: undefined,
      // config/tree-derived sets are authoritative, so they replace
      samplesCanonical: true,
    })
    display.setRowOrder([
      { name: 'panTro4' },
      { name: 'hg38' },
      { name: 'gone' },
    ])

    expect(rowNames(display)).toEqual(['panTro4', 'hg38'])
  })
})

// `((hg38,panTro4),mm10)` has four of the six orders of its leaves as
// rotations; hg38, mm10, panTro4 parts the sister pair, so no rotation lists
// it.
describe('the guide tree draws while a rotation of it lists `rows.domain`', () => {
  function treedDisplay() {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setSamples({
      // getSamples orders the sample list by the tree's leaves, which is what
      // lets leaf i land on row i
      samples: [sample('hg38'), sample('panTro4'), sample('mm10')],
      treeNewick: TREE,
      samplesCanonical: true,
    })
    return display
  }

  const named = (names: string[]) => names.map(name => ({ name }))

  function reorder(display: ReturnType<typeof treedDisplay>, names: string[]) {
    display.setRowOrder(named(names))
  }

  it('positions against the worker tree with no arrangement', () => {
    const display = treedDisplay()
    expect(display.rowTree).toBe(TREE)
    expect(display.hierarchy).toBeDefined()
  })

  it('keeps drawing after a reorder a rotation produces', () => {
    const display = treedDisplay()
    reorder(display, ['mm10', 'hg38', 'panTro4'])

    expect(display.rowTree).toBe(TREE)
    expect(display.hierarchy).toBeDefined()
    expect(rowNames(display)).toEqual(['mm10', 'hg38', 'panTro4'])
  })

  it('rotates towards a partial order written in the session', () => {
    const display = treedDisplay()
    reorder(display, ['panTro4'])

    expect(display.rowDomain).toEqual(['panTro4'])
    expect(display.hierarchy).toBeDefined()
    expect(rowNames(display)).toEqual(['panTro4', 'hg38', 'mm10'])
  })

  it('stops positioning after a reorder no rotation produces', () => {
    const display = treedDisplay()
    reorder(display, ['hg38', 'mm10', 'panTro4'])

    expect(display.rowTree).toBeUndefined()
    expect(display.hierarchy).toBeUndefined()
    expect(rowNames(display)).toEqual(['hg38', 'mm10', 'panTro4'])
  })

  // A submit that moves no row writes no order, so the relabel is all it
  // leaves behind.
  it('keeps drawing after a relabel-only dialog submit', () => {
    const display = treedDisplay()
    const [hg38, ...rest] = display.editableSources
    display.applyRowEdits([{ ...hg38!, label: 'Human' }, ...rest])

    expect(display.rowDomain).toEqual([])
    expect(display.rowLabels).toEqual({ hg38: 'Human' })
    expect(display.rowTree).toBe(TREE)
    expect(display.hierarchy).toBeDefined()
  })

  it('warns of a drop only for an order no rotation produces', () => {
    const display = treedDisplay()

    expect(
      display.rowOrderWillDropTree(named(['mm10', 'panTro4', 'hg38'])),
    ).toBe(false)
    expect(display.rowOrderWillDropTree(named(['panTro4']))).toBe(false)
    expect(
      display.rowOrderWillDropTree(named(['hg38', 'mm10', 'panTro4'])),
    ).toBe(true)
  })

  it('draws a run tree over the guide tree, and a reset returns to it', () => {
    const display = treedDisplay()
    const runTree = '((hg38,mm10),panTro4);'
    display.setRowOrder(named(['hg38', 'mm10', 'panTro4']), { tree: runTree })

    expect(display.rowTree).toBe(runTree)
    expect(display.hierarchy).toBeDefined()
    expect(rowNames(display)).toEqual(['hg38', 'mm10', 'panTro4'])
    expect(
      display.rowOrderWillDropTree(named(['mm10', 'hg38', 'panTro4'])),
    ).toBe(true)

    display.resetRowArrangement()

    expect(display.rowTree).toBe(TREE)
    expect(display.hierarchy).toBeDefined()
    expect(rowNames(display)).toEqual(['hg38', 'panTro4', 'mm10'])
  })

  it('restores the worker tree when the arrangement is cleared', () => {
    const display = treedDisplay()
    reorder(display, ['hg38', 'mm10', 'panTro4'])

    display.resetRowArrangement()

    expect(display.rowTree).toBe(TREE)
    expect(display.hierarchy).toBeDefined()
    expect(rowNames(display)).toEqual(['hg38', 'panTro4', 'mm10'])
  })

  // The filter is a set of row names, valid with or without a tree, and its
  // "Clear subtree filter" track-menu item is not gated on one.
  it('keeps a subtree filter across a reorder that drops the tree', () => {
    const display = treedDisplay()
    display.setRowFocus(['hg38', 'panTro4'])
    expect(rowNames(display)).toEqual(['hg38', 'panTro4'])

    reorder(display, ['panTro4', 'mm10', 'hg38'])

    expect(display.rowTree).toBeUndefined()
    expect(display.rowFocus).toEqual(['hg38', 'panTro4'])
    expect(rowNames(display)).toEqual(['panTro4', 'hg38'])
  })
})

describe('the declared `rows.domain` seeds the row order', () => {
  function domainDisplay(domain: string[]) {
    const { display } = createMafTestEnvironment({
      displayConfig: { rows: { domain } },
    }).createDisplay()
    display.setSamples({
      samples: [sample('hg38'), sample('panTro4'), sample('mm10')],
      treeNewick: TREE,
      samplesCanonical: true,
    })
    return display
  }

  it('leads with the species it names and leaves the rest in tree order', () => {
    expect(rowNames(domainDisplay(['mm10']))).toEqual([
      'mm10',
      'hg38',
      'panTro4',
    ])
  })

  it('ignores a species the data does not have', () => {
    expect(rowNames(domainDisplay(['rn6', 'panTro4']))).toEqual([
      'panTro4',
      'hg38',
      'mm10',
    ])
  })

  // The domain turns the guide tree rather than overruling it: mouse's branch
  // comes to the top and the dendrogram keeps drawing, because it is the same
  // tree. The rows follow its leaves, so `treeDescribesRows` holds by
  // construction rather than by luck.
  it('rotates the guide tree it leads with, and still draws it', () => {
    const display = domainDisplay(['mm10'])
    expect(display.rowTree).toBe(TREE)
    expect(display.hierarchy).toBeDefined()
    expect(rowNames(display)).toEqual(['mm10', 'hg38', 'panTro4'])
  })

  it('leaves the guide tree drawing when it agrees with the leaf order', () => {
    const display = domainDisplay(['hg38', 'panTro4'])
    expect(rowNames(display)).toEqual(['hg38', 'panTro4', 'mm10'])
    expect(display.hierarchy).toBeDefined()
  })

  // A species brings its clade with it, which is the whole difference from
  // placing each named row outright: that would read panTro4, mm10, hg38 and
  // leave the dendrogram describing nobody.
  it('keeps a clade together rather than placing each species outright', () => {
    const display = domainDisplay(['panTro4', 'mm10'])
    expect(rowNames(display)).toEqual(['panTro4', 'hg38', 'mm10'])
    expect(display.hierarchy).toBeDefined()
  })

  // Who wrote the domain does not matter: one written in the session rotates
  // the tree as a declared one does.
  it('rotates towards a session domain a rotation lists', () => {
    const display = domainDisplay(['mm10'])
    setConf(display, ['rows', 'domain'], ['panTro4', 'mm10'])
    expect(rowNames(display)).toEqual(['panTro4', 'hg38', 'mm10'])
    expect(display.rowTree).toBe(TREE)
    expect(display.hierarchy).toBeDefined()
  })

  // A declared domain too: the rows follow it, and the guide tree, which
  // cannot describe them, hides.
  it('orders by a domain no rotation lists and hides the guide tree', () => {
    const display = domainDisplay(['hg38', 'mm10', 'panTro4'])
    expect(rowNames(display)).toEqual(['hg38', 'mm10', 'panTro4'])
    expect(display.rowTree).toBeUndefined()
    expect(display.hierarchy).toBeUndefined()
  })

  // The filter runs over the rotated tree, so focusing the clade keeps the
  // order the domain turned it into.
  it('focuses a clade of the rotated tree in its rotated order', () => {
    const display = domainDisplay(['panTro4'])
    expect(rowNames(display)).toEqual(['panTro4', 'hg38', 'mm10'])

    display.setRowFocus(['hg38', 'panTro4'])

    expect(rowNames(display)).toEqual(['panTro4', 'hg38'])
    expect(display.hierarchy).toBeDefined()
  })

  // A drag, a clustering run or the arrangement dialog writes over the
  // declared order, and "Reset row order" returns to it rather than to the
  // adapter order.
  it('gives way to a reorder and comes back on a reset', () => {
    const display = domainDisplay(['mm10'])
    display.setRowOrder([
      { name: 'panTro4' },
      { name: 'hg38' },
      { name: 'mm10' },
    ])
    expect(rowNames(display)).toEqual(['panTro4', 'hg38', 'mm10'])

    display.resetRowArrangement()

    expect(rowNames(display)).toEqual(['mm10', 'hg38', 'panTro4'])
  })
})

// The adapter schemas advertise a per-sample `color` and the track guide calls
// it "the row's color". It lands on `MafSource.labelColor`, the field the
// sidebar's label half tints from — it used to be carried as `color` and
// translated on the way over, and because an object with extra properties
// satisfies `RowLabelSource`, handing `sources` straight to the sidebar
// type-checked and dropped it. Both the on-screen labels and the SVG export
// read `sources` directly now.
describe('the configured per-sample color reaches the sidebar', () => {
  it('lands on the `labelColor` the labels tint with', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setSamples({
      samples: [
        { id: 'hg38', label: 'Human', color: 'red' },
        { id: 'mm10', label: 'Mouse' },
      ],
      treeNewick: undefined,
      samplesCanonical: true,
    })
    expect(display.sources).toEqual([
      { name: 'hg38', label: 'Human', labelColor: 'red' },
      { name: 'mm10', label: 'Mouse', labelColor: undefined },
    ])
  })

  // Resolved, like `sources` it is derived from — an empty row list, not an
  // absent one. "Has the species list arrived" is `sourcesKnown`, and the
  // label components take an array either way.
  it('is empty before any fetch, like `sources`', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    expect(display.sources).toEqual([])
    expect(display.sourcesKnown).toBe(false)
  })
})

describe('rowColor tints a row over the adapter colour', () => {
  const SAMPLES = [
    { id: 'hg38', label: 'Human', color: 'red' },
    { id: 'mm10', label: 'Mouse' },
  ]

  function tinted(rowColor?: { domain: string[]; range: string[] }) {
    const { display } = createMafTestEnvironment({
      displayConfig: rowColor ? { rowColor } : {},
    }).createDisplay()
    display.setSamples({
      samples: SAMPLES,
      treeNewick: undefined,
      samplesCanonical: true,
    })
    return display
  }

  const tints = (display: { sources: { labelColor?: string }[] }) =>
    display.sources.map(s => s.labelColor)

  it('paints a declared entry ahead of the adapter colour', () => {
    const display = tinted({ domain: ['hg38'], range: ['#00ff00'] })
    expect(tints(display)).toEqual(['#00ff00', undefined])
    expect(display.rowArrangementIsCustom).toBe(false)
  })

  // The dialog shows the adapter colour and edits over it, so a row left at
  // that colour writes nothing and a row set back to it drops its entry.
  it('writes only what differs from the adapter, and a reset returns', () => {
    const display = tinted({ domain: ['hg38'], range: ['#00ff00'] })
    const [hg38, mm10] = display.editableSources
    display.applyRowEdits([
      { ...hg38!, labelColor: 'red' },
      { ...mm10!, labelColor: '#0000ff' },
    ])
    expect(getConf(display, ['rowColor', 'domain'])).toEqual(['mm10'])
    expect(getConf(display, ['rowColor', 'range'])).toEqual(['#0000ff'])
    expect(tints(display)).toEqual(['red', '#0000ff'])
    expect(display.rowArrangementIsCustom).toBe(true)

    display.resetRowArrangement()
    expect(tints(display)).toEqual(['#00ff00', undefined])
    expect(display.rowArrangementIsCustom).toBe(false)
  })

  it('offers a reset for a recolour alone', () => {
    const display = tinted()
    setConf(display, ['rowColor', 'domain'], ['mm10'])
    setConf(display, ['rowColor', 'range'], ['#0000ff'])
    expect(display.rowArrangementIsCustom).toBe(true)
  })

  // A config.json entry repeating the adapter's value is the admin's, so a
  // submit that changes nothing keeps it and offers no reset.
  it('keeps a declared entry equal to the adapter value through an unchanged submit', () => {
    const { display } = createMafTestEnvironment({
      displayConfig: {
        rows: { labels: { hg38: 'Human' } },
        rowColor: { domain: ['hg38'], range: ['red'] },
      },
    }).createDisplay()
    display.setSamples({
      samples: SAMPLES,
      treeNewick: undefined,
      samplesCanonical: true,
    })
    expect(display.rowArrangementIsCustom).toBe(false)

    display.applyRowEdits(display.editableSources)

    expect(display.rowLabels).toEqual({ hg38: 'Human' })
    expect(getConf(display, ['rowColor', 'domain'])).toEqual(['hg38'])
    expect(display.rowArrangementIsCustom).toBe(false)
  })
})

// The rows agree with what the worker ships for the focus (`visibleSamples`).
describe('a focus naming no current species', () => {
  function focused(samplesCanonical: boolean) {
    const { display } = createMafTestEnvironment({
      displayConfig: { rows: { kept: ['rn6'] } },
    }).createDisplay()
    display.setSamples({
      samples: [sample('hg38'), sample('mm10')],
      treeNewick: undefined,
      samplesCanonical,
    })
    return display
  }

  // Saved against rows that have since gone, by a renamed species or another
  // adapter.
  it('shows every row on a track that lists its species', () => {
    const display = focused(true)
    expect(rowNames(display)).toEqual(['hg38', 'mm10'])
    expect(display.subtreeFilterSet).toEqual(['rn6'])
  })

  it('shows no row on a track that discovers its species', () => {
    const display = focused(false)
    expect(rowNames(display)).toEqual([])
    expect(display.subtreeFilterSet).toEqual(['rn6'])
  })
})
