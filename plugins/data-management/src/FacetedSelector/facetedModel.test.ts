import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { autorun } from 'mobx'

import { MIN_PANEL_WIDTH, facetedStateTreeF } from './facetedModel.ts'

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
  const model = view.activateTrackSelector()
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

  test('a sort on a hidden column falls back to natural order', () => {
    const { faceted } = setup()
    faceted.setSort('name', true)
    faceted.setColumnVisible('name', false)
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
        .find((t: { trackId: string }) => t.trackId === trackId)!
        .setSlot('metadata', { note })
    }
    faceted.setShowSparse(true)
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
      session.sessionTracks.find(
        (t: { trackId: string }) => t.trackId === 'alpha',
      ),
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

describe('hidden columns', () => {
  test('persists under a config+assembly scoped key', () => {
    const { faceted } = setup()
    faceted.setShowSparse(true)
    faceted.setColumnVisible('adapter', false)
    const scopedKey = Object.keys(localStorage).find(k =>
      k.startsWith('facet-hiddenColumns'),
    )
    expect(scopedKey).toBeDefined()
    expect(scopedKey).toContain('volMyt1')
    expect(JSON.parse(localStorage.getItem(scopedKey!)!)).toEqual(['adapter'])
  })

  test('restores from the scoped key on load', () => {
    const probe = setup()
    probe.faceted.setShowSparse(true)
    probe.faceted.setColumnVisible('adapter', false)
    // a freshly created model for the same assemblies sees the hidden column
    const { faceted } = setup()
    faceted.setShowSparse(true)
    expect(faceted.visible.adapter).toBe(false)
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
