import { SimpleFeature } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { walkBreakendChain } from '@jbrowse/sv-core'

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
  expect(model.rows).toEqual([
    {
      id: 0,
      feature,
      score: 99,
      name: 'foo',
      derived: { location: 'chr1:1..100', size: 100 },
    },
  ])
})

test('rows handles legacy cells format', () => {
  const model = makeModel({
    rowSet: { rows: [{ cells: [{ text: 'chrX' }, { text: 42 }] }] },
    columns: [{ name: 'chr' }, { name: 'pos' }],
  })
  expect(model.rows).toEqual([
    { id: 0, feature: undefined, chr: 'chrX', pos: 42, derived: {} },
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
  const narrow = model.sheetColumns.find(c => c.field === 'c')!.width

  const model2 = makeModel({
    rowSet: {
      rows: [{ cellData: { c: 'x' } }, { cellData: { c: wide } }],
    },
    columns: [{ name: 'c' }],
  })
  expect(model2.sheetColumns.find(c => c.field === 'c')!.width).toBeGreaterThan(
    narrow,
  )
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

  function sizeColumn(overrides: Record<string, unknown>) {
    const model = makeModel(overrides)
    const col = model.sheetColumns.find(c => c.field === 'Length')!
    return {
      header: col.header,
      kind: col.kind,
      size: col.value(model.rows![0]!),
    }
  }

  test('a plain sheet reports the interval length under "Length"', () => {
    const col = sizeColumn({
      rowSet: { rows: [{ feature: insertion, cellData: { c: 'x' } }] },
      columns: [{ name: 'c' }],
    })
    expect(col.header).toBe('Length')
    expect(col.kind).toBe('number')
    expect(col.size).toBe(1)
  })

  test('an SV sheet reports the SV size instead', () => {
    const col = sizeColumn({
      rowSet: {
        rows: [{ feature: insertion, cellData: { 'INFO.SVTYPE': 'INS' } }],
      },
      columns: [{ name: 'INFO.SVTYPE' }],
    })
    expect(col.header).toBe('SV size')
    expect(col.size).toBe(2000)
  })

  test('a row with no size to report exports as blank, not "undefined"', () => {
    const model = makeModel({
      rowSet: { rows: [{ cellData: { 'INFO.SVTYPE': 'BND' } }] },
      columns: [{ name: 'INFO.SVTYPE' }],
    })
    expect(model.csvText().split('\r\n')[1]).toBe(',,,BND')
  })
})

describe('the SV type filter', () => {
  const sheet = (overrides: Record<string, unknown> = {}) =>
    makeModel({
      rowSet: {
        rows: ['DEL', 'DUP', 'INV', 'DEL'].map(svType => ({
          cellData: { 'INFO.SVTYPE': svType },
        })),
      },
      columns: [{ name: 'INFO.SVTYPE' }],
      ...overrides,
    })

  test('no class selected shows every row', () => {
    const model = sheet()
    expect([...model.svTypeFilter]).toEqual([])
    expect(model.gridRows?.map(r => r.id)).toEqual([0, 1, 2, 3])
  })

  test('toggling adds a class, and taking the last one out shows all', () => {
    const model = sheet()
    model.toggleSvType('DEL')
    expect(model.gridRows?.map(r => r.id)).toEqual([0, 3])
    model.toggleSvType('INV')
    expect([...model.svTypeFilter]).toEqual(['DEL', 'INV'])
    expect(model.gridRows?.map(r => r.id)).toEqual([0, 2, 3])
    model.toggleSvType('DEL')
    model.toggleSvType('INV')
    expect(model.gridRows?.map(r => r.id)).toEqual([0, 1, 2, 3])
  })

  test('the dropdown and the toggle write one filter', () => {
    const model = sheet()
    model.setGridFacet('sv-type-filter', ['DUP', 'INV'])
    model.toggleSvType('DUP')
    expect(model.gridFacets[0]).toMatchObject({
      multiple: true,
      selected: ['INV'],
    })
  })

  test('every class selected is no filter', () => {
    const model = sheet()
    model.toggleSvType('DEL')
    model.toggleSvType('DUP')
    model.toggleSvType('INV')
    expect([...model.svTypeFilter]).toEqual([])
    model.setGridFacet('sv-type-filter', ['INV', 'DUP', 'DEL'])
    expect([...model.svTypeFilter]).toEqual([])
  })

  test('a class the sheet does not hold narrows nothing', () => {
    const model = sheet({ svTypeFilter: ['BND'] })
    expect(model.gridRows?.map(r => r.id)).toEqual([0, 1, 2, 3])
    expect(model.gridFacets[0]?.selected).toEqual([])
    model.toggleSvType('DUP')
    expect([...model.svTypeFilter]).toEqual(['DUP'])
  })

  test('a session saved with one class reads it as the only class', () => {
    const model = sheet({ svTypeFilter: 'DUP' })
    expect([...model.svTypeFilter]).toEqual(['DUP'])
    expect(model.gridRows?.map(r => r.id)).toEqual([1])
  })
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
    sheet.setColumnVisible('Mate', false)
    sheet.setFilterText('chr1')
    expect(sheet.visibleRows?.map(r => r.id)).toEqual([0])
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
    sheet.setGridFacet('sv-event-filter', ['cluster_1'])
    expect(sheet.svEventFilter).toBe('cluster_1')
    expect(sheet.visibleRows?.map(r => r.id)).toEqual([0, 1, 2, 3])
  })

  test('the two dropdowns and the search narrow together', () => {
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
    sheet.setGridFacet('sv-event-filter', ['cluster_1'])
    sheet.setGridFacet('sv-type-filter', ['BND'])
    expect(sheet.gridRows?.map(r => r.id)).toEqual([0, 1, 2, 3])
    sheet.setFilterText('chr13')
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

describe('the search', () => {
  const sheet = () =>
    makeModel({
      rowSet: {
        rows: [
          { cellData: { ID: 'bnd_W', FILTER: 'PASS', POS: 1200 } },
          { cellData: { ID: 'bnd_X', FILTER: 'LowQual', POS: 34200 } },
          { cellData: { ID: 'del_Y', FILTER: 'PASS', POS: 512 } },
        ],
      },
      columns: [{ name: 'ID' }, { name: 'FILTER' }, { name: 'POS' }],
    })

  test('every word must match some column, in any case', () => {
    const model = sheet()
    model.setFilterText('BND pass')
    expect(model.visibleRows?.map(r => r.id)).toEqual([0])
    model.setFilterText('bnd')
    expect(model.visibleRows?.map(r => r.id)).toEqual([0, 1])
  })

  test('a number matches as its plain digits', () => {
    const model = sheet()
    model.setFilterText('342')
    expect(model.visibleRows?.map(r => r.id)).toEqual([1])
  })

  test('a hidden column is not searched', () => {
    const model = sheet()
    model.setColumnVisible('FILTER', false)
    model.setFilterText('lowqual')
    expect(model.visibleRows).toEqual([])
    model.setColumnVisible('FILTER', true)
    expect(model.visibleColumns).toEqual({})
    expect(model.visibleRows?.map(r => r.id)).toEqual([1])
  })

  test('clearing the box shows every row and leaves no search behind', () => {
    const model = sheet()
    model.setFilterText('bnd')
    model.setFilterText('')
    expect(model.filterText).toBeUndefined()
    expect(model.visibleRows).toHaveLength(3)
  })
})

describe('sorting', () => {
  const sheet = () =>
    makeModel({
      rowSet: {
        rows: [
          { cellData: { ID: 'a10', POS: 900 } },
          { cellData: { ID: 'a9', POS: 10000 } },
          { cellData: { ID: 'a100' } },
          { cellData: { ID: 'a1', POS: 85 } },
        ],
      },
      columns: [{ name: 'ID' }, { name: 'POS' }],
    })

  test('numbers sort as numbers, with a blank last either way', () => {
    const model = sheet()
    model.setSort('POS', true)
    expect(model.sortedRows.map(r => r.POS)).toEqual([
      85,
      900,
      10000,
      undefined,
    ])
    model.setSort('POS', false)
    expect(model.sortedRows.map(r => r.POS)).toEqual([
      10000,
      900,
      85,
      undefined,
    ])
  })

  test('text sorts in natural order', () => {
    const model = sheet()
    model.setSort('ID', true)
    expect(model.sortedRows.map(r => r.ID)).toEqual(['a1', 'a9', 'a10', 'a100'])
  })

  test('no sort, or a sort on a hidden column, keeps file order', () => {
    const model = sheet()
    model.setSort('POS', true)
    model.setColumnVisible('POS', false)
    expect(model.sortedRows.map(r => r.id)).toEqual([0, 1, 2, 3])
    model.setColumnVisible('POS', true)
    model.setSort('', true)
    expect(model.sortField).toBeUndefined()
    expect(model.sortedRows.map(r => r.id)).toEqual([0, 1, 2, 3])
  })
})

describe('the CSV export', () => {
  test('writes the sorted, searched rows under the shown headers, numbers plain and fields quoted', () => {
    const model = makeModel({
      rowSet: {
        rows: [
          { cellData: { NAME: 'plain', POS: 1234567, NOTE: 'x' } },
          { cellData: { NAME: 'a, "b"', POS: 12, NOTE: 'y' } },
          { cellData: { NAME: 'line\nbreak', POS: 5, NOTE: 'z' } },
          { cellData: { NAME: 'dropped', POS: 7, NOTE: 'q' } },
        ],
      },
      columns: [{ name: 'NAME' }, { name: 'POS' }, { name: 'NOTE' }],
    })
    model.setColumnVisible('Location', false)
    model.setColumnVisible('NOTE', false)
    model.setFilterText('a')
    model.setSort('POS', true)
    expect(model.csvText()).toBe(
      [
        'Length,NAME,POS',
        ',"line\nbreak",5',
        ',"a, ""b""",12',
        ',plain,1234567',
      ].join('\r\n'),
    )
  })
})

describe('the row the table scrolls to', () => {
  function sheetWithSelection(selectedId?: string) {
    const Model = stateModelFactory()
    const rows = ['f0', 'f1', 'f2', 'f3'].map((uniqueId, i) => ({
      feature: { uniqueId, refName: 'chr1', start: i * 10, end: i * 10 + 5 },
      cellData: { SCORE: 4 - i },
    }))
    const selection = selectedId
      ? new SimpleFeature({
          uniqueId: selectedId,
          refName: 'chr1',
          start: 0,
          end: 1,
        })
      : undefined
    const Session = types
      .model({
        rpcManager: types.frozen(),
        configuration: types.frozen(),
        sheet: types.maybe(Model),
      })
      .volatile(() => ({
        rowsTrackId: 'rows',
        selection,
        selectionTrackId: 'rows',
      }))
    return Session.create({
      rpcManager: {},
      configuration: {},
      sheet: { columns: [{ name: 'SCORE' }], rowSet: { rows } },
    }).sheet!
  }

  test('is where the selected row sits in the sorted rows', () => {
    const sheet = sheetWithSelection('f1')
    expect(sheet.selectedRowIndex).toBe(1)
    sheet.setSort('SCORE', true)
    expect(sheet.selectedRowIndex).toBe(2)
  })

  test('is none when the search leaves the selected row out, or nothing is selected', () => {
    const sheet = sheetWithSelection('f1')
    sheet.setFilterText('chr1:31')
    expect(sheet.selectedRowIndex).toBeUndefined()
    expect(sheetWithSelection().selectedRowIndex).toBeUndefined()
  })
})
