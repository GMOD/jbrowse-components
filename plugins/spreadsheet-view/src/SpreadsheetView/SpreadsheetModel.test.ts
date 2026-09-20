import { types } from '@jbrowse/mobx-state-tree'
import { walkBreakendChain } from '@jbrowse/sv-core'
import { autorun } from 'mobx'

import stateModelFactory from './SpreadsheetModel.tsx'

import type { Row } from './SpreadsheetModel.tsx'

const SpreadsheetStateModel = stateModelFactory()

function makeModel(overrides = {}) {
  return SpreadsheetStateModel.create({
    rowSet: undefined,
    columns: [],
    visibleColumns: {},
    ...overrides,
  })
}

test('rows returns undefined when no rowSet', () => {
  const model = makeModel()
  expect(model.rows).toBeUndefined()
})

test('rows maps cellData format to GridRow', () => {
  const feature = {
    refName: 'chr1',
    start: 0,
    end: 100,
    name: 'f1',
    uniqueId: 'f1',
  }
  const model = makeModel({
    rowSet: { rows: [{ feature, cellData: { score: 99, name: 'foo' } }] },
    columns: [{ name: 'score' }, { name: 'name' }],
  })
  expect(model.rows).toEqual([{ id: 0, feature, score: 99, name: 'foo' }])
})

test('rows handles legacy cells format', () => {
  const model = makeModel({
    rowSet: { rows: [{ cells: [{ text: 'chrX' }, { text: 42 }] }] },
    columns: [{ name: 'chr' }, { name: 'pos' }],
  })
  expect(model.rows).toEqual([
    { id: 0, feature: undefined, chr: 'chrX', pos: 42 },
  ])
})

// The migration is gated on a row actually being in the older shape, since it
// allocates a fresh object per row and runs on every snapshot applied — the
// fresh parse of an import included. The gate has to look at the whole sheet:
// keying off the first row would miss a file whose first row happens to carry
// neither legacy field
test('a legacy row anywhere in the sheet still triggers the migration', () => {
  const model = makeModel({
    rowSet: {
      rows: [
        { cellData: { chr: 'chr1', pos: 1 } },
        { cells: [{ text: 'chrX' }, { text: 42 }] },
      ],
    },
    columns: [{ name: 'chr' }, { name: 'pos' }],
  })
  expect(model.rows?.map(r => r.chr)).toEqual(['chr1', 'chrX'])
  expect(model.rows?.map(r => r.pos)).toEqual([1, 42])
})

test('rows assigns sequential ids across multiple rows', () => {
  const model = makeModel({
    rowSet: {
      rows: [
        { cellData: { x: 1 } },
        { cellData: { x: 2 } },
        { cellData: { x: 3 } },
      ],
    },
    columns: [{ name: 'x' }],
  })
  expect(model.rows?.map(r => r.id)).toEqual([0, 1, 2])
})

test('visibleRows returns all rows when no filter applied', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: {} }, { cellData: {} }, { cellData: {} }] },
    columns: [],
  })
  expect(model.visibleRows?.length).toBe(3)
})

test('visibleRows filters rows based on visibleRowFlags', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: {} }, { cellData: {} }, { cellData: {} }] },
    columns: [],
  })
  model.setVisibleRows({ 0: false, 2: false })
  expect(model.visibleRows?.map(r => r.id)).toEqual([1])
})

test('setVisibleRows(undefined) restores full row list', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: {} }, { cellData: {} }] },
    columns: [],
  })
  model.setVisibleRows({ 0: false })
  expect(model.visibleRows?.length).toBe(1)
  model.setVisibleRows(undefined)
  expect(model.visibleRows?.length).toBe(2)
})

// Regression: the grid rebuilds its visible-rows lookup on passes that cannot
// have changed the answer (a rows-set, a column-visibility change while a quick
// filter is on), and a fresh object each time re-derived visibleRows — which in
// the SV inspector is a whole new chord track built from every visible feature
test('re-reporting the same visible rows does not invalidate visibleRows', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: {} }, { cellData: {} }, { cellData: {} }] },
    columns: [],
  })
  let recomputes = 0
  const dispose = autorun(() => {
    void model.visibleRows
    recomputes++
  })
  expect(recomputes).toBe(1)

  model.setVisibleRows({ 0: false, 1: true, 2: true })
  expect(recomputes).toBe(2)
  // the same answer in a new object: nothing downstream should hear about it
  model.setVisibleRows({ 0: false, 1: true, 2: true })
  expect(recomputes).toBe(2)

  // a lookup that really differs still gets through, in either direction
  model.setVisibleRows({ 0: false, 1: false, 2: true })
  expect(recomputes).toBe(3)
  expect(model.visibleRows?.map(r => r.id)).toEqual([2])
  model.setVisibleRows({ 0: true, 1: true })
  expect(model.visibleRows?.map(r => r.id)).toEqual([0, 1, 2])
  dispose()
})

// Column widths come off a sample of the rows, since measuring all of them is
// seconds of blocked main thread on a large sheet. An ordinary file is smaller
// than the sample, so it must still be measured exactly — that is the part a
// change to the sampling could regress without anyone noticing
test('a sheet smaller than the width sample is still measured off every row', () => {
  const wide = 'W'.repeat(60)
  const model = makeModel({
    rowSet: {
      rows: [{ cellData: { c: 'x' } }, { cellData: { c: 'y' } }],
    },
    columns: [{ name: 'c' }],
  })
  const narrow = model.dataGridColumns!.find(c => c.field === 'c')!.width

  const model2 = makeModel({
    rowSet: {
      rows: [{ cellData: { c: 'x' } }, { cellData: { c: wide } }],
    },
    columns: [{ name: 'c' }],
  })
  expect(
    model2.dataGridColumns!.find(c => c.field === 'c')!.width,
  ).toBeGreaterThan(narrow)
})

test('svType getters are inert without an INFO.SVTYPE column', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: { ALT: '<DEL>' } }] },
    columns: [{ name: 'ALT' }],
  })
  expect(model.svTypeColumnField).toBeUndefined()
  expect(model.svTypeOptions).toEqual([])
})

// the dropdown names CLASSES, not raw tokens, so it and the SV inspector's
// legend cannot disagree about what a callset holds
test('svTypeOptions lists the classes present', () => {
  const model = makeModel({
    rowSet: {
      rows: [
        { cellData: { 'INFO.SVTYPE': 'DEL' } },
        { cellData: { 'INFO.SVTYPE': 'DUP' } },
        { cellData: { 'INFO.SVTYPE': 'DEL' } },
        { cellData: { 'INFO.SVTYPE': '' } },
      ],
    },
    columns: [{ name: 'INFO.SVTYPE' }],
  })
  expect(model.svTypeColumnField).toBe('INFO.SVTYPE')
  expect(model.svTypeOptions).toEqual([
    { type: 'DEL', label: 'Deletion', count: 2 },
    { type: 'DUP', label: 'Duplication', count: 1 },
  ])
})

// The derived size column is one column with two meanings, and the SVTYPE
// column is what picks between them. The field stays `Length` across both so a
// saved column-visibility preference covers either spelling
describe('the derived size column', () => {
  const insertion = {
    uniqueId: 'i1',
    refName: 'chr1',
    start: 100,
    end: 101,
    ALT: ['<INS>'],
    INFO: { SVLEN: [2000] },
  }

  // Narrowed to the three fields under test rather than read as a GridColDef:
  // `satisfies` keeps each column's literal type, so `find` hands back a union
  // whose other members have no headerName at all, and GridColDef's own
  // callbacks are generic over a row type this test does not have
  interface SizeColumn {
    headerName?: string
    valueGetter?: (v: unknown, row: { feature?: unknown }) => number | undefined
    valueFormatter?: (v?: number) => string
  }
  function sizeColumn(overrides: Record<string, unknown>) {
    return makeModel(overrides).dataGridColumns!.find(
      c => c.field === 'Length',
    )! as unknown as SizeColumn
  }

  test('a plain sheet reports the interval length under "Length"', () => {
    const col = sizeColumn({
      rowSet: { rows: [{ feature: insertion, cellData: { c: 'x' } }] },
      columns: [{ name: 'c' }],
    })
    expect(col.headerName).toBe('Length')
    expect(col.valueGetter!(undefined, { feature: insertion })).toBe(1)
  })

  test('an SV sheet reports the SV size instead', () => {
    const col = sizeColumn({
      rowSet: {
        rows: [{ feature: insertion, cellData: { 'INFO.SVTYPE': 'INS' } }],
      },
      columns: [{ name: 'INFO.SVTYPE' }],
    })
    expect(col.headerName).toBe('SV size')
    expect(col.valueGetter!(undefined, { feature: insertion })).toBe(2000)
  })

  test('a row with no size to report formats as blank, not "undefined"', () => {
    const col = sizeColumn({
      rowSet: { rows: [{ cellData: { 'INFO.SVTYPE': 'BND' } }] },
      columns: [{ name: 'INFO.SVTYPE' }],
    })
    expect(col.valueFormatter!(undefined)).toBe('')
  })
})

test('setSvTypeFilter stores the selected value', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: { 'INFO.SVTYPE': 'DEL' } }] },
    columns: [{ name: 'INFO.SVTYPE' }],
  })
  expect(model.svTypeFilter).toBeUndefined()
  model.setSvTypeFilter('DEL')
  expect(model.svTypeFilter).toBe('DEL')
  model.setSvTypeFilter(undefined)
  expect(model.svTypeFilter).toBeUndefined()
})

// Walking a rearrangement from one of its records to the rest. The row menu had
// no way to query the callset at all and so did not offer the option, while the
// chord click over the same records asked an adapter through RPC.
describe('the junctions the sheet can walk', () => {
  const assembly = { initialized: true, getCanonicalRefName2: (r: string) => r }

  function sheetWith(rows: Row[], columns = ['INFO.SVTYPE']) {
    const Model = stateModelFactory()
    const Session = types
      .model({
        rpcManager: types.frozen(),
        configuration: types.frozen(),
        sheet: types.maybe(Model),
      })
      .volatile(() => ({ assemblyManager: { get: () => assembly } }))
    return Session.create({
      rpcManager: {},
      configuration: {},
      sheet: {
        assemblyName: 'hg38',
        columns: columns.map(name => ({ name })),
        rowSet: { rows },
      },
    }).sheet!
  }

  const bnd = (id: string, refName: string, start: number, alt: string) => ({
    feature: { uniqueId: id, refName, start, end: start + 1, ALT: [alt] },
    cellData: { 'INFO.SVTYPE': 'BND' },
  })

  test('a breakend row becomes a junction, a plain interval does not', () => {
    const sheet = sheetWith([
      bnd('a', 'chr1', 100, 'C]chr5:900]'),
      { feature: { uniqueId: 'b', refName: 'chr1', start: 5, end: 9 } },
    ])
    expect(sheet.svJunctions).toEqual([
      {
        id: 'a',
        refName: 'chr1',
        pos: 100,
        keeps: -1,
        mateRefName: 'chr5',
        matePos: 899,
        mateKeeps: -1,
      },
    ])
  })

  test('a query returns only the junctions in its window', async () => {
    const sheet = sheetWith([
      bnd('a', 'chr1', 100, 'C]chr5:900]'),
      bnd('b', 'chr1', 5000, 'C]chr7:20]'),
      bnd('c', 'chr2', 100, 'C]chr9:30]'),
    ])
    const near = sheet.findJunctionsNear()
    expect(
      (await near({ refName: 'chr1', start: 0, end: 1000 })).map(
        j => j.mateRefName,
      ),
    ).toEqual(['chr5'])
    expect(await near({ refName: 'chr3', start: 0, end: 1e6 })).toEqual([])
  })

  // the filter narrows what is on screen; it is not a statement about which
  // junctions the rearrangement has
  test('a filtered-out row still continues a chain', async () => {
    const sheet = sheetWith([
      bnd('a', 'chr1', 100, 'C]chr5:900]'),
      bnd('b', 'chr5', 899, 'C]chr1:101]'),
    ])
    sheet.setVisibleRows({ 0: true, 1: false })
    expect(sheet.visibleRows).toHaveLength(1)
    // both spellings of the reciprocal pair are here — `b` filed at chr5, and
    // `a` reached through its mate end — and both name the same next locus, so
    // the walk reads one way onward rather than two
    expect(
      (
        await sheet.findJunctionsNear()({
          refName: 'chr5',
          start: 800,
          end: 1000,
        })
      ).map(j => `${j.refName}:${j.pos}`),
    ).toEqual(['chr1:100', 'chr5:899'])
  })

  test('a junction filed at its other end is still in the window', async () => {
    const sheet = sheetWith([bnd('a', 'chr1', 100, 'C]chr5:900]')])
    expect(
      (
        await sheet.findJunctionsNear()({
          refName: 'chr5',
          start: 800,
          end: 1000,
        })
      ).map(j => j.refName),
    ).toEqual(['chr1'])
  })

  // The whole point of the sheet answering this instead of an adapter. A
  // coordinate index knows one coordinate per record, so a chain written one
  // record per junction walks 4 / 3 / 2 stops depending on which record was
  // clicked; the sheet holds the parsed callset and matches on either end, so
  // every record of the event returns the same event.
  test('a chain written one record per junction walks from its last record', async () => {
    const sheet = sheetWith([
      bnd('j1', 'chr1', 100, 'C[chr2:201['),
      bnd('j2', 'chr2', 200, 'C[chr3:301['),
      bnd('j3', 'chr3', 300, 'C[chr4:401['),
    ])
    const findJunctionsNear = sheet.findJunctionsNear()
    const stops = await walkBreakendChain({
      start: sheet.svJunctions[2]!,
      findJunctionsNear,
    })
    expect(stops.map(s => `${s.refName}:${s.pos}`)).toEqual([
      'chr1:100',
      'chr2:200',
      'chr3:300',
      'chr4:400',
    ])
  })

  test('the own-locus-only filter an adapter is stuck with stops at two', async () => {
    const sheet = sheetWith([
      bnd('j1', 'chr1', 100, 'C[chr2:201['),
      bnd('j2', 'chr2', 200, 'C[chr3:301['),
      bnd('j3', 'chr3', 300, 'C[chr4:401['),
    ])
    const stops = await walkBreakendChain({
      start: sheet.svJunctions[2]!,
      findJunctionsNear: region =>
        Promise.resolve(
          sheet.svJunctions.filter(
            j =>
              j.refName === region.refName &&
              j.pos >= region.start &&
              j.pos < region.end,
          ),
        ),
    })
    expect(stops.map(s => `${s.refName}:${s.pos}`)).toEqual([
      'chr3:300',
      'chr4:400',
    ])
  })
  const inEvent = (
    row: ReturnType<typeof bnd>,
    key: string,
    event: string,
  ) => ({
    ...row,
    feature: { ...row.feature, name: row.feature.uniqueId },
    cellData: { ...row.cellData, [key]: event },
  })
  const mated = (row: ReturnType<typeof bnd>, mateId: string) => ({
    ...row,
    feature: { ...row.feature, INFO: { MATEID: [mateId] } },
  })

  // two junctions, each written from both ends, as the HG008 benchmark writes
  // EVENT=cluster_3, beside a lone translocation
  const chromoplexy = [
    mated(bnd('a', 'chr3', 100, 'C]chr13:900]'), 'a2'),
    mated(bnd('b', 'chr3', 5000, '[chr3:70001[C'), 'b2'),
    mated(bnd('b2', 'chr3', 70000, '[chr3:5001[C'), 'b'),
    mated(bnd('a2', 'chr13', 899, 'C]chr3:101]'), 'a'),
  ].map(r => inEvent(r, 'INFO.EVENT', 'cluster_1'))
  const lone = [
    mated(bnd('c', 'chr1', 10, 'C]chr2:20]'), 'c2'),
    mated(bnd('c2', 'chr2', 19, 'C]chr1:11]'), 'c'),
  ]
  const eventColumns = ['INFO.SVTYPE', 'INFO.EVENT']

  test('an event is a caller group holding more than one junction', () => {
    const sheet = sheetWith(
      [
        ...chromoplexy,
        // GRIDSS gives EVENT to the two mate records of one breakpoint
        ...lone.map(r => inEvent(r, 'INFO.EVENT', 'gridss7')),
        ...lone.map(r => inEvent(r, 'INFO.EVENT', 'cluster_10')),
      ],
      eventColumns,
    )
    expect(
      sheet.svEvents.map(({ label, count, refNames }) => ({
        label,
        count,
        refNames,
      })),
    ).toEqual([{ label: 'cluster_1', count: 4, refNames: ['chr3', 'chr13'] }])
    expect(sheet.svEvents[0]!.junctions).toHaveLength(4)
  })

  test('a caller-specific grouping key is not read as EVENT', () => {
    const sheet = sheetWith(
      chromoplexy.map(r => inEvent(r, 'INFO.CLUSTERID', 'severus_0')),
      ['INFO.SVTYPE', 'INFO.CLUSTERID'],
    )
    expect(sheet.svEventColumnField).toBeUndefined()
    expect(sheet.svEvents).toEqual([])
  })

  test('the event filter matches the whole value', () => {
    const sheet = sheetWith(
      [
        ...chromoplexy,
        ...chromoplexy.map(r => inEvent(r, 'INFO.EVENT', 'cluster_10')),
      ],
      eventColumns,
    )
    sheet.setGridFacet('sv-event-filter', 'cluster_1')
    expect(sheet.svEventFilter).toBe('cluster_1')
    expect(sheet.visibleRows?.map(r => r.id)).toEqual([0, 1, 2, 3])
  })

  test('the two dropdowns and the grid filter narrow together', () => {
    const del = {
      feature: {
        uniqueId: 'd',
        refName: 'chr3',
        start: 5,
        end: 900,
        ALT: ['<DEL>'],
      },
      cellData: { 'INFO.SVTYPE': 'DEL', 'INFO.EVENT': 'cluster_1' },
    }
    const sheet = sheetWith([...chromoplexy, del, ...lone], eventColumns)
    sheet.setGridFacet('sv-event-filter', 'cluster_1')
    sheet.setGridFacet('sv-type-filter', 'BND')
    expect(sheet.gridRows?.map(r => r.id)).toEqual([0, 1, 2, 3])
    sheet.setVisibleRows({ 0: true, 1: false, 2: false, 3: true })
    expect(sheet.visibleRows?.map(r => r.id)).toEqual([0, 3])
    expect(sheet.svTypeOptions.map(o => o.count)).toEqual([1, 6])
  })

  test('a record names its event, and one outside any names none', () => {
    const sheet = sheetWith([...chromoplexy, ...lone], eventColumns)
    expect(sheet.svEventFor(chromoplexy[2]!.feature)?.label).toBe('cluster_1')
    expect(sheet.svEventFor(lone[0]!.feature)).toBeUndefined()
  })

  test('a sheet with no event column offers no event dropdown', () => {
    const sheet = sheetWith(lone)
    expect(sheet.svEvents).toEqual([])
    expect(sheet.gridFacets.map(f => f.id)).toEqual(['sv-type-filter'])
  })
})
