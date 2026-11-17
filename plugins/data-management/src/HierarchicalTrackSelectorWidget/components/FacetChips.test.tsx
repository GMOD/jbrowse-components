import { createJBrowseTheme } from '@jbrowse/core/ui'
import { destroy, getRoot, isAlive } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, within } from '@testing-library/react'

import HierarchicalTrackSelector from './HierarchicalTrackSelector.tsx'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

beforeAll(() => {
  Element.prototype.scrollTo = () => {}
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// four fields that group the eight tracks, none mirroring another: assay,
// biosample and lab lead, target waits behind "More filters". No track name
// holds a metadata value
const BIOSAMPLE = ['K562', 'K562', 'HepG2', 'HepG2']
const TARGET = ['t1', 't1', 't2', 't2', 't2', 't2', 't1', 't1']

function setup({ metadata = true } = {}) {
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
  for (let i = 0; i < 8; i++) {
    session.addSessionTrackConf({
      trackId: `t${i}`,
      name: `track${i}`,
      assemblyNames: ['volMyt1'],
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
      ...(metadata
        ? {
            metadata: {
              assay: i < 4 ? 'ChIP' : 'DNase',
              biosample: BIOSAMPLE[i % 4],
              lab: i % 2 ? 'lab y' : 'lab x',
              target: TARGET[i],
            },
          }
        : {}),
    })
  }
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  return { session, model }
}

function renderSelector(model: HierarchicalTrackSelectorModel) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
}

function chipLabels(container: HTMLElement) {
  return [...container.querySelectorAll('.MuiChip-root')].map(
    c => c.textContent,
  )
}

function closePopover() {
  fireEvent.click(document.querySelector('.MuiBackdrop-root')!)
}

function treeTrackIds(model: HierarchicalTrackSelectorModel) {
  return model.rows.flatMap(({ item }) =>
    item.type === 'track' ? [item.trackId] : [],
  )
}

test('the leading facets get a chip and the rest wait behind "More filters"', () => {
  const { model } = setup()
  const { container } = renderSelector(model)
  expect(chipLabels(container)).toEqual([
    'assay',
    'biosample',
    'lab',
    'More filters',
  ])
})

test('a list with no field that groups tracks gets no chip row', () => {
  const { model } = setup({ metadata: false })
  const { container } = renderSelector(model)
  expect(chipLabels(container)).toEqual([])
})

test('an active chip names its selection, filters the tree, and clears with its ×', () => {
  const { model } = setup()
  const { container, getByText, getByLabelText } = renderSelector(model)
  fireEvent.click(getByText('biosample'))
  fireEvent.click(getByLabelText('K562'))
  fireEvent.click(getByLabelText('HepG2'))
  closePopover()

  const chip = getByText('biosample: K562 +1').closest('.MuiChip-root')!
  expect(model.trackTable.filters.get('metadata.biosample')).toEqual([
    'K562',
    'HepG2',
  ])

  fireEvent.click(within(chip as HTMLElement).getByTestId('CancelIcon'))
  expect(model.trackTable.filters.size).toBe(0)
  expect(chipLabels(container)).toContain('biosample')
})

test('the chips stay put while the filter box matches nothing', () => {
  const { model } = setup()
  const { container, getByLabelText } = renderSelector(model)
  const before = chipLabels(container)
  fireEvent.change(getByLabelText('Filter tracks'), {
    target: { value: 'zzz' },
  })
  expect(model.rows.filter(r => r.item.type === 'track')).toEqual([])
  expect(chipLabels(container)).toEqual(before)
})

test('a chip keeps its popover anchored while its last value is unchecked', () => {
  const { model } = setup()
  const { container, getByText, getByLabelText } = renderSelector(model)
  fireEvent.click(getByText('More filters'))
  fireEvent.click(getByText('target'))
  fireEvent.click(getByLabelText('t1'))
  closePopover()
  expect(chipLabels(container)).toContain('target: t1')

  fireEvent.click(getByText('target: t1'))
  fireEvent.click(getByLabelText('t1'))
  const chip = [...container.querySelectorAll('.MuiChip-root')].find(
    c => c.textContent === 'target',
  )
  expect(chip?.getAttribute('aria-expanded')).toBe('true')
  expect(chip?.isConnected).toBe(true)

  closePopover()
  expect(chipLabels(container)).not.toContain('target')
})

test("in tree mode the chips count what the tree's own search keeps", () => {
  const { model } = setup()
  const table = model.trackTable
  model.setFilterText('K562')
  expect(treeTrackIds(model)).toEqual([])
  expect(table.facetCategoryCounts.get('metadata.biosample')?.size).toBe(0)

  model.openTable()
  expect(table.facetCategoryCounts.get('metadata.biosample')).toEqual(
    new Map([['K562', 4]]),
  )
})

test('the tree and the table count a filter that keeps every track alike', () => {
  const { model } = setup()
  model.setFilterText('-zzz')
  const tree = model.matchCounts
  expect(tree?.matched).toBe(tree?.total)
  model.openTable()
  expect(model.trackTable.matchCounts).toEqual(tree)
})

test('the facets, sort and add-to-selection mode survive Tree → Table → Tree', () => {
  const { model } = setup()
  const table = model.trackTable
  const { getByTestId, getByText } = renderSelector(model)
  act(() => {
    table.setFilter('metadata.biosample', ['K562'])
    table.setSort('name', false)
    table.setUseShoppingCart(true)
  })
  expect(treeTrackIds(model).toSorted()).toEqual(['t0', 't1', 't4', 't5'])
  expect(getByText('biosample: K562')).toBeTruthy()

  fireEvent.click(getByTestId('show-as-table'))
  expect(getByText('biosample: K562')).toBeTruthy()
  expect(table.sortedRows.map(r => r.id)).toEqual(['t5', 't4', 't1', 't0'])

  fireEvent.click(getByTestId('show-as-tree'))
  expect(model.trackTable).toBe(table)
  expect(getByText('biosample: K562')).toBeTruthy()
  expect(table.sortField).toBe('name')
  expect(table.useShoppingCart).toBe(true)
  expect(treeTrackIds(model).toSorted()).toEqual(['t0', 't1', 't4', 't5'])
})

test('a facet filter narrows the favorites list too', () => {
  const { model } = setup()
  model.addToFavorites('t0')
  model.addToFavorites('t2')
  model.setTrackList('favorites')
  model.trackTable.setFilter('metadata.biosample', ['K562'])
  expect(treeTrackIds(model)).toEqual(['t0'])
})

test('the table header holds the columns menu, and the tree has none', async () => {
  const { model } = setup()
  const view = renderSelector(model)
  expect(view.queryByTestId('track-table-menu')).toBeNull()
  view.unmount()

  model.openTable()
  const { findByTestId, findByText } = renderSelector(model)
  fireEvent.click(await findByTestId('track-table-menu'))
  expect(
    await findByText('Add tracks to selection instead of turning them on/off'),
  ).toBeTruthy()
  expect(await findByText('Manage columns')).toBeTruthy()
})

test("destroying the session destroys its selector's table", () => {
  const { model } = setup()
  const table = model.trackTable
  destroy(getRoot(model))
  expect(isAlive(table)).toBe(false)
})
