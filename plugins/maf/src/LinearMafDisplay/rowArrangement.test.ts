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
    display.setLayout([{ name: 'panTro4' }, { name: 'hg38' }])

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
      color: 'red',
    })
    // and the rename reaches the sidebar, which tints from `labelColor`
    expect(display.labelSources[1]).toEqual({
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
    display.setLayout([{ name: 'panTro4' }, { name: 'hg38' }, { name: 'gone' }])

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
    display.setLayout([{ name: 'mm10' }, { name: 'hg38' }, { name: 'panTro4' }])

    expect(display.clusterTree).toBeUndefined()
    expect(display.hierarchy).toBeUndefined()
    expect(rowNames(display)).toEqual(['mm10', 'hg38', 'panTro4'])
  })

  it('restores the worker tree when the arrangement is cleared', () => {
    const display = treedDisplay()
    display.setLayout([{ name: 'mm10' }, { name: 'hg38' }, { name: 'panTro4' }])

    display.clearLayout()

    expect(display.clusterTree).toBe(TREE)
    expect(display.hierarchy).toBeDefined()
    expect(rowNames(display)).toEqual(['hg38', 'panTro4', 'mm10'])
  })

  // The filter is a set of row names, valid with or without a tree, and its
  // "Clear subtree filter" track-menu item is not gated on one.
  it('keeps a subtree filter across a reorder that drops the tree', () => {
    const display = treedDisplay()
    display.setSubtreeFilter(['hg38', 'panTro4'])
    expect(rowNames(display)).toEqual(['hg38', 'panTro4'])

    display.setLayout([{ name: 'panTro4' }, { name: 'hg38' }, { name: 'mm10' }])

    expect(display.clusterTree).toBeUndefined()
    expect(display.subtreeFilter?.slice()).toEqual(['hg38', 'panTro4'])
    expect(rowNames(display)).toEqual(['panTro4', 'hg38'])
  })
})

// The adapter schemas advertise a per-sample `color` and the track guide calls
// it "the row's color", but `MafSource` names the field `color` while the
// sidebar's label half tints from `labelColor` — and an object with extra
// properties satisfies `RowLabelSource`, so handing `sources` straight over
// type-checked and dropped it. `labelSources` is the rename, and both the
// on-screen labels and the SVG export read it.
describe('the configured per-sample color reaches the sidebar', () => {
  it('surfaces `color` as the `labelColor` the labels tint with', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setSamples({
      samples: [
        { id: 'hg38', label: 'Human', color: 'red' },
        { id: 'mm10', label: 'Mouse' },
      ],
      treeNewick: undefined,
      samplesCanonical: true,
    })
    expect(display.labelSources).toEqual([
      { name: 'hg38', label: 'Human', labelColor: 'red' },
      { name: 'mm10', label: 'Mouse', labelColor: undefined },
    ])
  })

  // Resolved, like `sources` it is derived from — an empty row list, not an
  // absent one. "Has the species list arrived" is `sourcesKnown`, and the
  // label components take an array either way.
  it('is empty before any fetch, like `sources`', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    expect(display.labelSources).toEqual([])
    expect(display.sourcesKnown).toBe(false)
  })
})
