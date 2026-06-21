import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

import { facetedStateTreeF } from './facetedModel.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  localStorage.clear()
})

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
    session.addTrackConf({
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
  faceted.setTrackConfigurations(
    model.allTrackConfigurations,
    getSession(model),
    model.assemblyNames,
  )
  return faceted
}

describe('sorting', () => {
  test('sortedRows preserves natural order with no sort field', () => {
    const faceted = setup()
    expect(faceted.sortedRows.map(r => r.name)).toEqual([
      'charlie',
      'alpha',
      'bravo',
    ])
  })

  test('ascending name sort', () => {
    const faceted = setup()
    faceted.setSort('name', true)
    expect(faceted.sortedRows.map(r => r.name)).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ])
  })

  test('descending name sort', () => {
    const faceted = setup()
    faceted.setSort('name', false)
    expect(faceted.sortedRows.map(r => r.name)).toEqual([
      'charlie',
      'bravo',
      'alpha',
    ])
  })

  test('sorting does not mutate filteredRows order', () => {
    const faceted = setup()
    faceted.setSort('name', true)
    expect(faceted.filteredRows.map(r => r.name)).toEqual([
      'charlie',
      'alpha',
      'bravo',
    ])
  })
})

describe('hidden columns', () => {
  test('persists under a config+assembly scoped key', () => {
    const faceted = setup()
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
    probe.setShowSparse(true)
    probe.setColumnVisible('adapter', false)
    // a freshly created model for the same assemblies sees the hidden column
    const faceted = setup()
    faceted.setShowSparse(true)
    expect(faceted.visible.adapter).toBe(false)
  })
})

describe('clearFilters', () => {
  test('removes all active facet selections', () => {
    const faceted = setup()
    faceted.setFilter('name', ['alpha'])
    expect(faceted.filteredRows.map(r => r.name)).toEqual(['alpha'])
    faceted.clearFilters()
    expect(faceted.filteredRows).toHaveLength(3)
  })
})
