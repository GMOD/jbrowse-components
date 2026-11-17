import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { autorun } from 'mobx'

import { trackTableModelFactory } from './trackTableModel.ts'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
})

const REFSEQ = 'Reference sequence (volMyt1)'

function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
        ],
      },
    },
  })
  // names chosen so insertion order (charlie, alpha, bravo) differs from sorted
  for (const name of ['charlie', 'alpha', 'bravo']) {
    session.addSessionTrackConf({
      trackId: name,
      name,
      assemblyNames: ['volMyt1'],
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
  }
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  const table = trackTableModelFactory().create({})
  table.setTrackSource(
    () => model.allTrackConfigurations,
    getSession(model),
    model.assemblyNames,
  )
  // the reference sequence track only joins allTrackConfigurations once
  // assemblyManager.get has resolved the assembly, so warm it here to keep row
  // counts the same no matter how many times a test reads them
  void model.allTrackConfigurations.length
  return { session, model, table }
}

describe('sorting', () => {
  test('sortedRows preserves natural order with no sort field', () => {
    const { table } = setup()
    expect(table.sortedRows.map(r => r.name)).toEqual([
      REFSEQ,
      'charlie',
      'alpha',
      'bravo',
    ])
  })

  test('ascending name sort', () => {
    const { table } = setup()
    table.setSort('name', true)
    expect(table.sortedRows.map(r => r.name)).toEqual([
      'alpha',
      'bravo',
      'charlie',
      REFSEQ,
    ])
  })

  test('descending name sort', () => {
    const { table } = setup()
    table.setSort('name', false)
    expect(table.sortedRows.map(r => r.name)).toEqual([
      REFSEQ,
      'charlie',
      'bravo',
      'alpha',
    ])
  })

  test('sorting does not mutate filteredRows order', () => {
    const { table } = setup()
    table.setSort('name', true)
    expect(table.filteredRows.map(r => r.name)).toEqual([
      REFSEQ,
      'charlie',
      'alpha',
      'bravo',
    ])
  })

  test('hiding the sorted column drops the sort', () => {
    const { table } = setup()
    table.setSort('kind', true)
    table.setColumnVisible('kind', false)
    expect(table.sortField).toBe('')
    expect(table.sortedRows.map(r => r.name)).toEqual([
      REFSEQ,
      'charlie',
      'alpha',
      'bravo',
    ])
  })
})

describe('html-valued metadata', () => {
  // metadata cells render through SanitizedHTML, so searching and sorting have
  // to work on the displayed text rather than the raw slot
  function setupWithMarkup() {
    const { session, table } = setup()
    for (const [trackId, note] of [
      ['charlie', '<i>zebra</i>'],
      ['alpha', '<b>aardvark</b>'],
    ]) {
      session.sessionTracks
        .find(t => t.trackId === trackId)!
        .setSlot('metadata', { note })
    }
    return table
  }

  test('a query matches the text, not the markup around it', () => {
    const table = setupWithMarkup()
    table.setFilterText('zebra')
    expect(table.rows.map(r => r.name)).toEqual(['charlie'])
    // 'i' would match the <i> tag if the raw slot were searched
    table.setFilterText('<i>')
    expect(table.rows).toHaveLength(0)
  })

  test('sorting orders by the text, not by the leading angle bracket', () => {
    const table = setupWithMarkup()
    table.setSort('metadata.note', true)
    expect(
      table.sortedRows.filter(r => r.metadata.note).map(r => r.name),
    ).toEqual(['alpha', 'charlie'])
  })
})

describe('live track source', () => {
  test('a track deleted while the selector is open drops out of the rows', () => {
    const { session, table } = setup()
    // observed, as in the app: an unobserved computed recomputes on every read
    const dispose = autorun(() => table.rows.length)
    expect(table.rows.map(r => r.name)).toContain('alpha')

    session.deleteTrackConf(
      session.sessionTracks.find(t => t.trackId === 'alpha')!,
    )

    expect(table.rows.map(r => r.name)).not.toContain('alpha')
    dispose()
  })

  test('a track added while the selector is open appears in the rows', () => {
    const { session, table } = setup()
    const dispose = autorun(() => table.rows.length)
    const before = table.rows.length

    session.addSessionTrackConf({
      trackId: 'delta',
      name: 'delta',
      assemblyNames: ['volMyt1'],
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })

    expect(table.rows.map(r => r.name)).toContain('delta')
    expect(table.rows.length).toBe(before + 1)
    dispose()
  })
})

describe('column choices', () => {
  test('persist under a config+assembly scoped key', () => {
    const { table } = setup()
    table.setColumnVisible('adapter', true)
    table.setColumnVisible('kind', false)
    const scopedKey = Object.keys(localStorage).find(k =>
      k.startsWith('facet-columnChoices'),
    )
    expect(scopedKey).toContain('volMyt1')
    expect(JSON.parse(localStorage.getItem(scopedKey!)!)).toEqual([
      { field: 'adapter', show: true },
      { field: 'kind', show: false },
    ])
  })

  test('restore from the scoped key on load, skipping malformed entries', () => {
    setup().table.setColumnVisible('adapter', true)
    const scopedKey = Object.keys(localStorage).find(k =>
      k.startsWith('facet-columnChoices'),
    )!
    localStorage.setItem(
      scopedKey,
      JSON.stringify([{ field: 'adapter', show: true }, 'kind', { field: 1 }]),
    )
    const { table } = setup()
    expect(table.columnChoices).toEqual([{ field: 'adapter', show: true }])
    expect(table.shownColumns(0)).toEqual(['name', 'adapter'])
  })
})

describe('columns and facets', () => {
  function addAssayTracks(
    session: ReturnType<typeof setup>['session'],
    assays: string[],
  ) {
    for (const [i, assay] of assays.entries()) {
      session.addSessionTrackConf({
        trackId: `a${i}`,
        name: `a${i}`,
        description: `a${i} signal`,
        category: [i % 2 ? 'Signal' : 'Peaks'],
        metadata: {
          assay,
          url: `https://example.com/a${i}`,
          flag: true,
          format: assay === 'DNase' ? 'bigWig' : 'bigBed',
          lab: i === 0 || i === 3 ? 'X' : 'Y',
        },
        assemblyNames: ['volMyt1'],
        type: 'FeatureTrack',
        adapter: { type: 'FromConfigAdapter', features: [] },
      })
    }
  }

  test('the default columns are the fields that group tracks, most widely set first', () => {
    const { session, table } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP', 'ChIP', 'ChIP'])
    expect(table.fields).toEqual([
      'name',
      'description',
      'category',
      'kind',
      'metadata.assay',
      'metadata.url',
      'metadata.flag',
      'metadata.format',
      'metadata.lab',
      'adapter',
    ])
    // every track but the reference sequence is a Feature, so kind groups
    // nothing; nor does a unique url, a constant flag or a per-track
    // description; format says what assay says
    expect(table.groupingFields).toEqual([
      'category',
      'metadata.assay',
      'metadata.lab',
    ])
    expect(table.shownColumns(1)).toEqual(['name', 'category'])
    expect(table.shownColumns(9)).toEqual([
      'name',
      'category',
      'metadata.assay',
      'metadata.lab',
    ])
  })

  test('the configured columns come first, and the grouping fields fill the room after them', () => {
    const { session, table } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP'])
    table.setConfiguredColumns(['name', 'metadata.lab'])
    expect(table.defaultColumns).toEqual([
      'metadata.lab',
      'category',
      'metadata.assay',
    ])
    table.setConfiguredColumns(['metadata.nope'])
    expect(table.defaultColumns).toEqual(table.groupingFields)
  })

  test('the config names the columns, and the user’s choices win over both', () => {
    const { session, table } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP'])
    table.setConfiguredColumns(['metadata.assay', 'metadata.nope', 'kind'])
    expect(table.shownColumns(1)).toEqual(['name', 'metadata.assay'])

    table.setColumnVisible('metadata.assay', false)
    table.setColumnVisible('metadata.url', true)
    expect(table.shownColumns(1)).toEqual(['name', 'metadata.url'])
    expect(table.shownColumns(2)).toEqual(['name', 'kind', 'metadata.url'])
  })

  test('the facet panel keeps a facet that is still filtering', () => {
    const { session, table } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP'])
    expect(table.filterFacets).not.toContain('metadata.flag')
    table.setFilter('metadata.flag', ['true'])
    expect(table.filterFacets).toContain('metadata.flag')
    expect([...table.facetCategoryCounts.keys()]).toContain('metadata.flag')
  })

  test('the first three default columns that group tracks, shown grouping columns and active filters start open', () => {
    const { session, table } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP'])
    table.setConfiguredColumns(['description', 'metadata.assay', 'adapter'])
    expect([...table.openFacets]).toEqual([
      'metadata.assay',
      'category',
      'metadata.lab',
    ])
    table.setColumnVisible('metadata.url', true)
    table.setFilter('metadata.flag', ['true'])
    expect([...table.openFacets]).toEqual([
      'metadata.assay',
      'category',
      'metadata.lab',
      'metadata.flag',
    ])
  })

  test('a facet keeps its place when it starts or stops filtering, and a non-grouping column gets none', () => {
    const { session, table } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP'])
    table.setConfiguredColumns(['description'])
    const before = table.filterFacets
    expect(before).not.toContain('description')
    const last = before.at(-1)!
    table.setFilter(last, ['x'])
    expect(table.filterFacets).toEqual(before)
    table.setFilter(last, [])
    expect(table.filters.size).toBe(0)
    expect(table.filterFacets).toEqual(before)
  })

  test('a search lists name matches first when no column is sorted', () => {
    const { session, table } = setup()
    addAssayTracks(session, ['DNase', 'DNase'])
    session.addSessionTrackConf({
      trackId: 'named',
      name: 'Peaks a1 rerun',
      assemblyNames: ['volMyt1'],
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
    table.setFilterText('peaks')
    expect(table.sortedRows.map(r => r.name)).toEqual(['Peaks a1 rerun', 'a0'])
    table.setSort('name', true)
    expect(table.sortedRows.map(r => r.name)).toEqual(['a0', 'Peaks a1 rerun'])
  })
})
