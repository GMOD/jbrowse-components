import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { createMafTestEnvironment } from './testEnv.ts'

// The MAF's own name for its reference, deliberately not the view's assembly
// (`volvox`) — the case `refAssemblyName` exists for, and the one where the two
// possible answers differ.
const REF = 'hg38'

function sample(id: string) {
  return { id, label: id }
}

function makeDisplay(samples: string[]) {
  const { display } = createMafTestEnvironment().createDisplay()
  display.setSamples({
    samples: samples.map(sample),
    treeNewick: `((${samples[0]},${samples[1]}),${samples[2]});`,
    samplesCanonical: true,
  })
  return display
}

// One landed region whose blocks name `refSampleId`, which is the only thing
// that tells the display which row the reference is.
function landRegion(
  display: ReturnType<typeof makeDisplay>,
  refSampleId = REF,
) {
  display.setRpcData(
    0,
    testWireRegionData(
      [
        {
          startBp: 100,
          refSeq: 'AAAA',
          rows: [{ sampleId: refSampleId, seq: 'AAAA', chr: 'chr1' }],
        },
      ],
      { coverage: emptyMafCoverage(0), refSampleId },
    ),
  )
}

function rowNames(d: ReturnType<typeof makeDisplay>) {
  return d.sources.map(s => s.name)
}

// Names of the positioned dendrogram's leaves, in draw order. `leaves` is
// internal to tree-sidebar, and this only has to walk three nodes.
function leafNames(node: {
  data?: { name?: string }
  children?: unknown[] | null
}): string[] {
  const children = node.children as (typeof node)[] | null | undefined
  return children?.length
    ? children.flatMap(c => leafNames(c))
    : [node.data?.name ?? '']
}

// Under the default mismatch coloring the reference's own row matches at every
// column, so it draws as a solid match-colored bar carrying no information.
// UCSC omits it.
test('hiding the reference drops its row and leaves the others in order', () => {
  const display = makeDisplay([REF, 'panTro4', 'mm10'])
  landRegion(display)
  expect(rowNames(display)).toEqual([REF, 'panTro4', 'mm10'])

  display.setShowReferenceRow(false)
  expect(rowNames(display)).toEqual(['panTro4', 'mm10'])
})

// `rpcDataMap` is where the worker's answer arrives and it is emptied under the
// display — `clearAlignmentData` on every zoom out to the summary tier,
// `clearDisplaySpecificData` on chromosome navigation. Read back out of that
// map, the reference id would revert to the view's assembly name, which is a
// different string exactly here — and the row the user hid would reappear for
// as long as the view sat zoomed out.
test('the hidden row stays hidden once the alignment data is dropped', () => {
  const display = makeDisplay([REF, 'panTro4', 'mm10'])
  landRegion(display)
  display.setShowReferenceRow(false)

  display.clearAlignmentData()
  expect(rowNames(display)).toEqual(['panTro4', 'mm10'])
})

// A track can be re-pointed at another adapter, or have `refAssemblyName`
// edited, without the display being torn down — `invalidateSettings` keeps the
// instance. A latched id would go on hiding the row the old config named.
test('a later region naming a different reference moves the hidden row', () => {
  const display = makeDisplay([REF, 'panTro4', 'mm10'])
  landRegion(display)
  display.setShowReferenceRow(false)
  expect(rowNames(display)).toEqual(['panTro4', 'mm10'])

  landRegion(display, 'panTro4')
  expect(rowNames(display)).toEqual([REF, 'mm10'])
})

// The guide tree still carries the reference's leaf, and
// `computeClusterHierarchy` declines to position a tree that no longer
// describes the rows — so without pruning it too, hiding one row would take the
// whole dendrogram with it.
test('the dendrogram survives the hidden row', () => {
  const display = makeDisplay([REF, 'panTro4', 'mm10'])
  landRegion(display)
  expect(display.hierarchy && leafNames(display.hierarchy)).toEqual([
    REF,
    'panTro4',
    'mm10',
  ])

  display.setShowReferenceRow(false)
  expect(display.hierarchy && leafNames(display.hierarchy)).toEqual([
    'panTro4',
    'mm10',
  ])
})
