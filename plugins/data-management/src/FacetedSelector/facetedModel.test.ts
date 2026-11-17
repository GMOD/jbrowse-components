import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { autorun } from 'mobx'

import { MIN_PANEL_WIDTH, facetedStateTreeF } from './facetedModel.ts'

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
  const faceted = facetedStateTreeF().create({})
  faceted.setTrackSource(
    () => model.allTrackConfigurations,
    getSession(model),
    model.assemblyNames,
  )
  // the reference sequence track only joins allTrackConfigurations once
  // assemblyManager.get has resolved the assembly, so warm it here to keep row
  // counts the same no matter how many times a test reads them
  void model.allTrackConfigurations.length
  return { session, model, faceted }
}

describe('sorting', () => {
  test('sortedRows preserves natural order with no sort field', () => {
    const { faceted } = setup()
    expect(faceted.sortedRows.map(r => r.name)).toEqual([
      REFSEQ,
      'charlie',
      'alpha',
      'bravo',
    ])
  })

  test('ascending name sort', () => {
    const { faceted } = setup()
    faceted.setSort('name', true)
    expect(faceted.sortedRows.map(r => r.name)).toEqual([
      'alpha',
      'bravo',
      'charlie',
      REFSEQ,
    ])
  })

  test('descending name sort', () => {
    const { faceted } = setup()
    faceted.setSort('name', false)
    expect(faceted.sortedRows.map(r => r.name)).toEqual([
      REFSEQ,
      'charlie',
      'bravo',
      'alpha',
    ])
  })

  test('sorting does not mutate filteredRows order', () => {
    const { faceted } = setup()
    faceted.setSort('name', true)
    expect(faceted.filteredRows.map(r => r.name)).toEqual([
      REFSEQ,
      'charlie',
      'alpha',
      'bravo',
    ])
  })

  test('hiding the sorted column drops the sort', () => {
    const { faceted } = setup()
    faceted.setSort('kind', true)
    faceted.setColumnVisible('kind', false)
    expect(faceted.sortField).toBe('')
    expect(faceted.sortedRows.map(r => r.name)).toEqual([
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
    const { session, faceted } = setup()
    for (const [trackId, note] of [
      ['charlie', '<i>zebra</i>'],
      ['alpha', '<b>aardvark</b>'],
    ]) {
      session.sessionTracks
        .find(t => t.trackId === trackId)!
        .setSlot('metadata', { note })
    }
    return faceted
  }

  test('a query matches the text, not the markup around it', () => {
    const faceted = setupWithMarkup()
    faceted.setFilterText('zebra')
    expect(faceted.rows.map(r => r.name)).toEqual(['charlie'])
    // 'i' would match the <i> tag if the raw slot were searched
    faceted.setFilterText('<i>')
    expect(faceted.rows).toHaveLength(0)
  })

  test('sorting orders by the text, not by the leading angle bracket', () => {
    const faceted = setupWithMarkup()
    faceted.setSort('metadata.note', true)
    expect(
      faceted.sortedRows.filter(r => r.metadata.note).map(r => r.name),
    ).toEqual(['alpha', 'charlie'])
  })
})

describe('live track source', () => {
  test('a track deleted while the selector is open drops out of the rows', () => {
    const { session, faceted } = setup()
    // observed, as in the app: an unobserved computed recomputes on every read
    const dispose = autorun(() => faceted.rows.length)
    expect(faceted.rows.map(r => r.name)).toContain('alpha')

    session.deleteTrackConf(
      session.sessionTracks.find(t => t.trackId === 'alpha')!,
    )

    expect(faceted.rows.map(r => r.name)).not.toContain('alpha')
    dispose()
  })

  test('a track added while the selector is open appears in the rows', () => {
    const { session, faceted } = setup()
    const dispose = autorun(() => faceted.rows.length)
    const before = faceted.rows.length

    session.addSessionTrackConf({
      trackId: 'delta',
      name: 'delta',
      assemblyNames: ['volMyt1'],
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })

    expect(faceted.rows.map(r => r.name)).toContain('delta')
    expect(faceted.rows.length).toBe(before + 1)
    dispose()
  })
})

describe('column choices', () => {
  test('persist under a config+assembly scoped key', () => {
    const { faceted } = setup()
    faceted.setColumnVisible('adapter', true)
    faceted.setColumnVisible('kind', false)
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
    setup().faceted.setColumnVisible('adapter', true)
    const scopedKey = Object.keys(localStorage).find(k =>
      k.startsWith('facet-columnChoices'),
    )!
    localStorage.setItem(
      scopedKey,
      JSON.stringify([{ field: 'adapter', show: true }, 'kind', { field: 1 }]),
    )
    const { faceted } = setup()
    expect(faceted.columnChoices).toEqual([{ field: 'adapter', show: true }])
    expect(faceted.shownColumns(0)).toEqual(['name', 'adapter'])
  })
})

describe('clearFilters', () => {
  test('removes all active facet selections', () => {
    const { faceted } = setup()
    faceted.setFilter('name', ['alpha'])
    expect(faceted.filteredRows.map(r => r.name)).toEqual(['alpha'])
    faceted.clearFilters()
    expect(faceted.filteredRows).toHaveLength(4)
  })
})

describe('panelWidth', () => {
  test('a drag past the left edge cannot invert the filter pane', () => {
    const { faceted } = setup()
    faceted.setPanelWidth(-50)
    expect(faceted.panelWidth).toBe(MIN_PANEL_WIDTH)
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
    const { session, faceted } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP', 'ChIP', 'ChIP'])
    expect(faceted.fields).toEqual([
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
    expect(faceted.groupingFields).toEqual([
      'category',
      'metadata.assay',
      'metadata.lab',
    ])
    expect(faceted.shownColumns(1)).toEqual(['name', 'category'])
    expect(faceted.shownColumns(9)).toEqual([
      'name',
      'category',
      'metadata.assay',
      'metadata.lab',
    ])
  })

  test('the configured columns come first, and the grouping fields fill the room after them', () => {
    const { session, faceted } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP'])
    faceted.setConfiguredColumns(['name', 'metadata.lab'])
    expect(faceted.defaultColumns).toEqual([
      'metadata.lab',
      'category',
      'metadata.assay',
    ])
    faceted.setConfiguredColumns(['metadata.nope'])
    expect(faceted.defaultColumns).toEqual(faceted.groupingFields)
  })

  test('the config names the columns, and the user’s choices win over both', () => {
    const { session, faceted } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP'])
    faceted.setConfiguredColumns(['metadata.assay', 'metadata.nope', 'kind'])
    expect(faceted.shownColumns(1)).toEqual(['name', 'metadata.assay'])

    faceted.setColumnVisible('metadata.assay', false)
    faceted.setColumnVisible('metadata.url', true)
    expect(faceted.shownColumns(1)).toEqual(['name', 'metadata.url'])
    expect(faceted.shownColumns(2)).toEqual(['name', 'kind', 'metadata.url'])
  })

  test('the facet panel keeps a facet that is still filtering', () => {
    const { session, faceted } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP'])
    expect(faceted.filterFacets).not.toContain('metadata.flag')
    faceted.setFilter('metadata.flag', ['true'])
    expect(faceted.filterFacets).toContain('metadata.flag')
    expect([...faceted.facetCategoryCounts.keys()]).toContain('metadata.flag')
  })

  test('the first three default columns that group tracks, shown grouping columns and active filters start open', () => {
    const { session, faceted } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP'])
    faceted.setConfiguredColumns(['description', 'metadata.assay', 'adapter'])
    expect([...faceted.openFacets]).toEqual([
      'metadata.assay',
      'category',
      'metadata.lab',
    ])
    faceted.setColumnVisible('metadata.url', true)
    faceted.setFilter('metadata.flag', ['true'])
    expect([...faceted.openFacets]).toEqual([
      'metadata.assay',
      'category',
      'metadata.lab',
      'metadata.flag',
    ])
  })

  test('a facet keeps its place when it starts or stops filtering, and a non-grouping column gets none', () => {
    const { session, faceted } = setup()
    addAssayTracks(session, ['DNase', 'DNase', 'ChIP', 'ChIP'])
    faceted.setConfiguredColumns(['description'])
    const before = faceted.filterFacets
    expect(before).not.toContain('description')
    const last = before.at(-1)!
    faceted.setFilter(last, ['x'])
    expect(faceted.filterFacets).toEqual(before)
    faceted.setFilter(last, [])
    expect(faceted.filters.size).toBe(0)
    expect(faceted.filterFacets).toEqual(before)
  })

  test('a search lists name matches first when no column is sorted', () => {
    const { session, faceted } = setup()
    addAssayTracks(session, ['DNase', 'DNase'])
    session.addSessionTrackConf({
      trackId: 'named',
      name: 'Peaks a1 rerun',
      assemblyNames: ['volMyt1'],
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
    faceted.setFilterText('peaks')
    expect(faceted.sortedRows.map(r => r.name)).toEqual([
      'Peaks a1 rerun',
      'a0',
    ])
    faceted.setSort('name', true)
    expect(faceted.sortedRows.map(r => r.name)).toEqual([
      'a0',
      'Peaks a1 rerun',
    ])
  })
})
