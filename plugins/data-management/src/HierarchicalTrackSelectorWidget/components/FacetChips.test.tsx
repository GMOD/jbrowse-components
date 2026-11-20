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

function setup({ metadata = true, category = false } = {}) {
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
      ...(category ? { category: [i % 2 ? 'Odd' : 'Even'] } : {}),
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

function closeMenu() {
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
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
    'Assay',
    'Biosample',
    'Lab',
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
  fireEvent.click(getByText('Biosample'))
  fireEvent.click(getByLabelText('K562'))
  fireEvent.click(getByLabelText('HepG2'))
  closePopover()

  const chip = getByText('Biosample: K562 +1').closest('.MuiChip-root')!
  expect(model.trackTable.filters.get('metadata.biosample')).toEqual([
    'K562',
    'HepG2',
  ])

  fireEvent.click(within(chip as HTMLElement).getByTestId('CancelIcon'))
  expect(model.trackTable.filters.size).toBe(0)
  expect(chipLabels(container)).toContain('Biosample')
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
  fireEvent.click(getByText('Target'))
  fireEvent.click(getByLabelText('t1'))
  closePopover()
  expect(chipLabels(container)).toContain('Target: t1')

  fireEvent.click(getByText('Target: t1'))
  fireEvent.click(getByLabelText('t1'))
  const chip = [...container.querySelectorAll('.MuiChip-root')].find(
    c => c.textContent === 'Target',
  )
  expect(chip?.getAttribute('aria-expanded')).toBe('true')
  expect(chip?.isConnected).toBe(true)

  closePopover()
  expect(chipLabels(container)).not.toContain('Target')
})

function chip(container: HTMLElement, label: string) {
  return [...container.querySelectorAll<HTMLElement>('.MuiChip-root')].find(
    c => c.textContent === label,
  )!
}

function clearByKeyboard(el: HTMLElement) {
  el.focus()
  fireEvent.keyDown(el, { key: 'Backspace' })
  fireEvent.keyUp(el, { key: 'Backspace' })
}

test('clearing a "More filters" chip from the keyboard hands focus to "More filters"', () => {
  const { model } = setup()
  const { container } = renderSelector(model)
  act(() => {
    model.trackTable.setFilter('metadata.target', ['t1'])
  })
  clearByKeyboard(chip(container, 'Target: t1'))
  expect(chipLabels(container)).not.toContain('Target: t1')
  expect(document.activeElement?.textContent).toBe('More filters')
})

test('clearing the last chip behind "More filters" hands focus to the filter box', () => {
  const { model } = setup()
  const { container, getByLabelText } = renderSelector(model)
  act(() => {
    model.trackTable.setColumnVisible('metadata.target', true)
    model.trackTable.setFilter('metadata.flag', ['on'])
  })
  clearByKeyboard(chip(container, 'Flag: on'))
  expect(chipLabels(container)).not.toContain('More filters')
  expect(document.activeElement === getByLabelText('Filter tracks')).toBe(true)
})

test('clearing a leading chip keeps focus on it', () => {
  const { model } = setup()
  const { container } = renderSelector(model)
  act(() => {
    model.trackTable.setFilter('metadata.lab', ['lab x'])
  })
  clearByKeyboard(chip(container, 'Lab: lab x'))
  expect(document.activeElement?.textContent).toBe('Lab')
})

test('a chip opens a dialog named for its facet, and "More filters" one of its own', () => {
  const { model } = setup()
  const { container, getByRole, getByText } = renderSelector(model)
  const biosample = chip(container, 'Biosample')
  expect(biosample.getAttribute('aria-haspopup')).toBe('dialog')
  fireEvent.click(getByText('Biosample'))
  expect(
    within(getByRole('dialog', { name: 'Biosample' })).getByLabelText('K562'),
  ).toBeTruthy()
  closePopover()

  expect(chip(container, 'More filters').getAttribute('aria-haspopup')).toBe(
    'dialog',
  )
  fireEvent.click(getByText('More filters'))
  expect(
    within(getByRole('dialog', { name: 'More filters' })).getByText('Target'),
  ).toBeTruthy()
})

test("in tree mode the chips count what the tree's own search keeps", () => {
  const { model } = setup()
  const table = model.trackTable
  model.setFilterText('K562')
  expect(treeTrackIds(model)).toEqual([])
  expect(table.facetCounts('metadata.biosample').size).toBe(0)

  model.openTable()
  expect(table.facetCounts('metadata.biosample')).toEqual(
    new Map([['K562', 4]]),
  )
})

test('the tree and the table count a filter that keeps every track alike', () => {
  const { model } = setup()
  model.setFilterText('-zzz')
  const tree = model.trackTable.matchCounts
  expect(tree?.matched).toBe(tree?.total)
  model.openTable()
  expect(model.trackTable.matchCounts).toEqual(tree)
})

test('the facets and sort survive Tree → Table → Tree', () => {
  const { model } = setup()
  const table = model.trackTable
  const { getByTestId, getByText } = renderSelector(model)
  act(() => {
    table.setFilter('metadata.biosample', ['K562'])
    table.setSort('name', false)
  })
  expect(treeTrackIds(model).toSorted()).toEqual(['t0', 't1', 't4', 't5'])
  expect(getByText('Biosample: K562')).toBeTruthy()

  fireEvent.click(getByTestId('show-as-table'))
  expect(getByText('Biosample: K562')).toBeTruthy()
  expect(table.sortedRows.map(r => r.id)).toEqual(['t5', 't4', 't1', 't0'])

  fireEvent.click(getByTestId('show-as-tree'))
  expect(model.trackTable).toBe(table)
  expect(getByText('Biosample: K562')).toBeTruthy()
  expect(table.sortField).toBe('name')
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

test("the ☰ menu holds the table's rows in table mode only", async () => {
  const { model } = setup()
  const view = renderSelector(model)
  fireEvent.click(await view.findByTestId('track-selector-hamburger'))
  await view.findByText('Add track...')
  expect(view.queryByText('Manage columns')).toBeNull()
  view.unmount()

  model.openTable()
  const { findByTestId, findByText, queryByTestId } = renderSelector(model)
  expect(queryByTestId('track-table-menu')).toBeNull()
  fireEvent.click(await findByTestId('track-selector-hamburger'))
  expect(await findByText('Manage columns')).toBeTruthy()
})

test("the table's ☰ menu adds what a filter kept to the selection, and only while one narrows the list", async () => {
  const { model } = setup()
  model.openTable()
  const { findByTestId, findByText, queryByText } = renderSelector(model)
  fireEvent.click(await findByTestId('track-selector-hamburger'))
  await findByText('Manage columns')
  expect(queryByText('Add matching tracks to selection')).toBeNull()
  closeMenu()

  act(() => {
    model.trackTable.setFilter('metadata.biosample', ['K562'])
  })
  fireEvent.click(await findByTestId('track-selector-hamburger'))
  fireEvent.click(await findByText('Add matching tracks to selection'))
  expect(model.selection.map(c => c.trackId).toSorted()).toEqual([
    't0',
    't1',
    't4',
    't5',
  ])
  expect(model.shownTrackIds.size).toBe(0)
})

test('the tree has no category chip, since its headings filter by category, until a category filter is set', () => {
  const { model } = setup({ metadata: false, category: true })
  const tree = renderSelector(model)
  expect(chipLabels(tree.container)).not.toContain('Category')
  act(() => {
    model.trackTable.setFilter('category', ['Odd'])
  })
  expect(chipLabels(tree.container)).toContain('Category: Odd')
  act(() => {
    model.trackTable.setFilter('category', [])
  })
  tree.unmount()

  model.openTable()
  const table = renderSelector(model)
  expect(chipLabels(table.container)).toContain('Category')
})

test("destroying the session destroys its selector's table", () => {
  const { model } = setup()
  const table = model.trackTable
  destroy(getRoot(model))
  expect(isAlive(table)).toBe(false)
})

test("clearing the tree's category chip hands focus to the filter box", () => {
  const { model } = setup({ metadata: false, category: true })
  const { container, getByLabelText } = renderSelector(model)
  act(() => {
    model.trackTable.setFilter('category', ['Odd'])
  })
  clearByKeyboard(chip(container, 'Category: Odd'))
  expect(chipLabels(container)).not.toContain('Category: Odd')
  expect(document.activeElement === getByLabelText('Filter tracks')).toBe(true)
})
