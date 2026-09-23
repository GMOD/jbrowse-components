import { setConf } from '@jbrowse/core/configuration'

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
  // blocks contain it, so the row set grows as the user scrolls. `layout` is an
  // ordering hint, never the row set — a merge that iterated it alone meant a
  // species revealed by a later region never got a row at all.
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

  it('drops a layout row the data no longer has', () => {
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

describe('the guide tree positions only while it describes the rows', () => {
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

  it('positions against the worker tree with no arrangement', () => {
    const display = treedDisplay()
    expect(display.clusterTree).toBe(TREE)
    expect(display.hierarchy).toBeDefined()
  })

  it('stops positioning once the rows are reordered', () => {
    const display = treedDisplay()
    display.setRowOrder([
      { name: 'mm10' },
      { name: 'hg38' },
      { name: 'panTro4' },
    ])

    expect(display.clusterTree).toBeUndefined()
    expect(display.hierarchy).toBeUndefined()
    expect(rowNames(display)).toEqual(['mm10', 'hg38', 'panTro4'])
  })

  it('restores the worker tree when the arrangement is cleared', () => {
    const display = treedDisplay()
    display.setRowOrder([
      { name: 'mm10' },
      { name: 'hg38' },
      { name: 'panTro4' },
    ])

    display.resetRowArrangement()

    expect(display.clusterTree).toBe(TREE)
    expect(display.hierarchy).toBeDefined()
    expect(rowNames(display)).toEqual(['hg38', 'panTro4', 'mm10'])
  })

  // The filter is a set of row names, valid with or without a tree, and its
  // "Clear subtree filter" track-menu item is not gated on one.
  it('keeps a subtree filter across a reorder that drops the tree', () => {
    const display = treedDisplay()
    display.setRowFocus(['hg38', 'panTro4'])
    expect(rowNames(display)).toEqual(['hg38', 'panTro4'])

    display.setRowOrder([
      { name: 'panTro4' },
      { name: 'hg38' },
      { name: 'mm10' },
    ])

    expect(display.clusterTree).toBeUndefined()
    expect(display.subtreeFilter?.slice()).toEqual(['hg38', 'panTro4'])
    expect(rowNames(display)).toEqual(['panTro4', 'hg38'])
  })
})

describe('the config `domain` seeds the row order', () => {
  function domainDisplay(domain: string[]) {
    const { display } = createMafTestEnvironment({
      displayConfig: { domain },
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
    expect(display.clusterTree).toBe(TREE)
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

  // The rotation is derived from the current domain every time, never written
  // into the tree, so emptying the slot puts the rows and the dendrogram back
  // in file order.
  it('returns to the file order when the domain is emptied', () => {
    const display = domainDisplay(['mm10'])
    setConf(display, 'domain', [])
    expect(rowNames(display)).toEqual(['hg38', 'panTro4', 'mm10'])
    expect(display.hierarchy).toBeDefined()
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

  // `layout` is the runtime channel over the seed: a drag, a clustering run or
  // the arrangement dialog still wins, and "Reset row order" returns to the
  // domain rather than to the adapter order.
  it('gives way to a layout and comes back when it is cleared', () => {
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
