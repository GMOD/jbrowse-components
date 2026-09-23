import { getLeafNames } from '@jbrowse/tree-sidebar'

import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { runMafClustering } from './runMafClustering.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

import type { MafSource, LinearMafDisplayModel } from './stateModel.ts'

type Display = LinearMafDisplayModel

// Adapter samples as a `samples` config supplies them: a label and a colour
// are the row's own. Canonical order is the guide tree's leaf order.
const SAMPLES = [
  { id: 'hg38', label: 'Human', color: '#aa0000' },
  { id: 'panTro4', label: 'Chimp' },
  { id: 'mm10', label: 'Mouse', color: '#0000aa' },
]

const TREE = '((hg38,panTro4),mm10);'

interface Arrangement {
  domain?: string[]
}

// The arrangement settings, spelled once: the derivation pinned below is what
// has to survive their move into the `rows` object, so this helper is all of
// the file that move may change.
function arrangementConfig({ domain }: Arrangement) {
  return domain ? { domain } : {}
}

function loaded({
  tree,
  ...arrangement
}: Arrangement & { tree?: boolean } = {}) {
  const { display } = createMafTestEnvironment({
    displayConfig: arrangementConfig(arrangement),
  }).createDisplay()
  display.setSamples({
    samples: SAMPLES,
    treeNewick: tree ? TREE : undefined,
    samplesCanonical: true,
  })
  return display
}

// At bp 102 hg38 carries G and the other two T, so a sort there puts the T
// block first.
function landRegion(display: Display) {
  stageDetailRegion(
    display,
    0,
    testWireRegionData(
      [
        {
          startBp: 100,
          refSeq: 'ACGT',
          rows: [
            { sampleId: 'hg38', seq: 'ACGT' },
            { sampleId: 'panTro4', seq: 'ACTT' },
            { sampleId: 'mm10', seq: 'ACTT' },
          ],
        },
      ],
      { coverage: emptyMafCoverage(100), refSampleId: 'hg38' },
    ),
  )
}

async function cluster(display: Display, order: number[], tree: string) {
  await runMafClustering({
    model: display,
    rpcManager: { call: async () => ({ order, tree }) },
    sessionId: 'session',
    regions: [{ assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 }],
    signal: new AbortController().signal,
    statusCallback: () => {},
  })
}

function row({ name, label, labelColor }: MafSource) {
  return { name, label, labelColor }
}

function derived(display: Display) {
  return {
    sources: display.sources.map(row),
    editableSources: display.editableSources.map(row),
    rowTree: display.rowTree,
    treeLeaves: display.root && getLeafNames(display.root),
    treeDrawn: display.hierarchy !== undefined,
    subtreeFilterSet: display.subtreeFilterSet,
    rpcProps: display.rpcProps(),
    rowArrangementIsCustom: display.rowArrangementIsCustom,
  }
}

test('adapter labels and colours are the rows own', () => {
  expect(derived(loaded())).toMatchSnapshot()
})

test('a supplied guide tree leads the rows', () => {
  expect(derived(loaded({ tree: true }))).toMatchSnapshot()
})

test('a declared order rotates a supplied tree', () => {
  expect(derived(loaded({ tree: true, domain: ['mm10'] }))).toMatchSnapshot()
  expect(
    derived(loaded({ tree: true, domain: ['panTro4', 'mm10'] })),
  ).toMatchSnapshot()
})

test('a declared order leads with no tree', () => {
  expect(derived(loaded({ domain: ['mm10', 'panTro4'] }))).toMatchSnapshot()
})

test('a reorder drops the supplied tree and a reset restores it', () => {
  const display = loaded({ tree: true, domain: ['mm10'] })
  const [mm10, hg38, panTro4] = display.editableSources
  display.setRowOrder([panTro4!, hg38!, mm10!])
  expect(derived(display)).toMatchSnapshot()
  display.resetRowArrangement()
  expect(derived(display)).toMatchSnapshot()
})

test('a discovered row joins after a reorder', () => {
  const display = loaded()
  display.setRowOrder([{ name: 'mm10' }, { name: 'hg38' }])
  display.setSamples({
    samples: [{ id: 'rn6', label: 'Rat' }],
    treeNewick: undefined,
    samplesCanonical: false,
  })
  expect(derived(display)).toMatchSnapshot()
})

test('a cluster run lands its tree with provenance, and a reset restores the supplied one', async () => {
  const display = loaded({ tree: true })
  await cluster(display, [2, 0, 1], '(mm10,(hg38,panTro4));')
  expect(derived(display)).toMatchSnapshot()
  expect(display.rowTreeProvenance).toMatchSnapshot()
  display.resetRowArrangement()
  expect(derived(display)).toMatchSnapshot()
})

test('a cluster run rotates towards the declared order', async () => {
  const display = loaded({ domain: ['panTro4'] })
  await cluster(display, [2, 0, 1], '(mm10,(hg38,panTro4));')
  expect(derived(display)).toMatchSnapshot()
})

test('a focus narrows the rows and the fetch key', () => {
  const display = loaded({ tree: true })
  display.setRowFocus(['panTro4', 'hg38'])
  expect(derived(display)).toMatchSnapshot()
  display.setRowFocus(['mm10', 'hg38'])
  expect(derived(display)).toMatchSnapshot()
  display.setRowFocus(undefined)
  expect(derived(display)).toMatchSnapshot()
})

test('a focused cluster run keeps the hidden row after the clade', async () => {
  const display = loaded({ tree: true, domain: ['mm10'] })
  display.setRowFocus(['hg38', 'panTro4'])
  await cluster(display, [1, 0], '(panTro4,hg38);')
  expect(derived(display)).toMatchSnapshot()
  display.setRowFocus(undefined)
  expect(derived(display)).toMatchSnapshot()
})

test('hiding the reference row prunes it from the rows and the tree', () => {
  const display = loaded({ tree: true })
  landRegion(display)
  display.setShowReferenceRow(false)
  expect(derived(display)).toMatchSnapshot()
  display.setRowFocus(['hg38', 'panTro4'])
  expect(derived(display)).toMatchSnapshot()
})

test('dialog edits reorder, relabel and recolour, and a reset returns', () => {
  const display = loaded({ tree: true })
  const [hg38, panTro4, mm10] = display.editableSources
  display.applyRowEdits([
    { ...mm10!, label: 'House mouse' },
    hg38!,
    { ...panTro4!, labelColor: '#123456' },
  ])
  expect(derived(display)).toMatchSnapshot()
  display.resetRowArrangement()
  expect(derived(display)).toMatchSnapshot()
})

test('a dialog recolour over an adapter colour, in place', () => {
  const display = loaded()
  const [hg38, ...rest] = display.editableSources
  display.applyRowEdits([{ ...hg38!, labelColor: '#00ff00' }, ...rest])
  expect(derived(display)).toMatchSnapshot()
})

test('sort at a column orders the rows by base and drops the supplied tree', () => {
  const display = loaded({ tree: true })
  landRegion(display)
  expect(display.sortRowsByBaseAt('ctgA', 102)).toBe(true)
  expect(derived(display)).toMatchSnapshot()
})
