import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render } from '@testing-library/react'

import { naturalTableWidth } from '../../TrackTable/components/tableLayout.ts'
import HierarchicalTrackSelector from './HierarchicalTrackSelector.tsx'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// jsdom doesn't implement Element.scrollTo, which the grid's useVirtualRows
// calls when the filter changes
beforeAll(() => {
  Element.prototype.scrollTo = () => {}
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function setup(adminMode = false) {
  const session = createTestSession({ adminMode })
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
  for (const name of ['chromatin', 'genes']) {
    session.addSessionTrackConf({
      trackId: name,
      name,
      assemblyNames: ['volMyt1'],
      type: 'FeatureTrack',
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
  }
  const addView = () =>
    session.addView('LinearGenomeView', {
      displayedRegions: [
        { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
      ],
    })
  const view = addView()
  const model = view.activateTrackSelector() as HierarchicalTrackSelectorModel
  return { session, model, addView }
}

test('the add track button stays in table mode', async () => {
  const { model } = setup(true)
  const { getByTestId, findByTestId, queryByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  await findByTestId('hierarchical-add-track-fab')
  fireEvent.click(getByTestId('show-as-table'))
  expect(model.showTable).toBe(true)
  expect(queryByTestId('hierarchical-add-track-fab')).not.toBeNull()
})

test('the toggle swaps the tree for a table seeded with its query, with select-all hidden, and back', async () => {
  const { model } = setup()
  model.setFilterText(' chrom ')
  const { getByTestId, findByLabelText, queryByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  const tree = getByTestId('show-as-tree')
  const table = getByTestId('show-as-table')
  expect(tree.getAttribute('aria-pressed')).toBe('true')

  fireEvent.click(table)
  const search = await findByLabelText('Filter tracks')
  expect((search as HTMLInputElement).value).toBe(' chrom ')
  expect(table.getAttribute('aria-pressed')).toBe('true')
  expect(queryByLabelText('Select all tracks')).toBeNull()

  fireEvent.change(search, { target: { value: 'genes' } })
  fireEvent.click(tree)
  expect(model.showTable).toBe(false)
  expect(getByTestId('show-as-tree')).toBe(tree)
  expect(model.filterText).toBe('genes')
})

test('the table widens the drawer to its natural width without touching the saved width, a drag resizes the table width, and closing returns to the saved one', () => {
  const { session, model } = setup()
  session.updateDrawerWidth(200, 2000)
  const natural = naturalTableWidth(model.trackTable)
  expect(natural).toBeGreaterThan(200)

  model.openTable({ width: 200, availableWidth: 2000 })
  expect(session.effectiveDrawerWidth).toBe(natural)
  expect(session.drawerWidth).toBe(200)

  session.updateDrawerWidth(1000, 2000)
  expect(session.effectiveDrawerWidth).toBe(1000)
  expect(session.drawerWidth).toBe(200)

  model.closeTable()
  expect(session.effectiveDrawerWidth).toBe(200)
})

test('the table widens the drawer no further than 45% of the room, and never narrows it', () => {
  const { model } = setup()
  model.openTable({ width: 100, availableWidth: 300 })
  expect(model.preferredDrawerWidth).toBe(135)
  model.openTable({ width: 1000, availableWidth: 2000 })
  expect(model.preferredDrawerWidth).toBe(1000)
})

test('a table opened with no drawer to measure asks for no width', () => {
  const { session, model } = setup()
  model.openTable()
  expect(model.showTable).toBe(true)
  expect(session.effectiveDrawerWidth).toBe(session.drawerWidth)
})

test('table mode stays with the view it was opened for', () => {
  const { session, model, addView } = setup()
  model.openTable({ width: 400, availableWidth: 2000 })
  const other = addView()
  expect(other.activateTrackSelector()).toBe(model)
  expect(model.showTable).toBe(false)
  expect(session.effectiveDrawerWidth).toBe(session.drawerWidth)
})

test('closing the selector leaves table mode, so reopening it shows the tree', () => {
  const { session, model } = setup()
  model.openTable({ width: 400, availableWidth: 2000 })
  session.hideWidget(model)
  expect(model.showTable).toBe(false)
  session.showWidget(model)
  expect(session.effectiveDrawerWidth).toBe(session.drawerWidth)
})

test('the recent list is flat, newest first, with no category tree or group header', () => {
  const { model } = setup()
  model.addToRecentlyUsed('genes')
  model.addToRecentlyUsed('chromatin')
  model.setTrackList('recent')
  expect(
    model.rows.map(({ item }) =>
      item.type === 'track' ? item.trackId : `[${item.name}]`,
    ),
  ).toEqual(['chromatin', 'genes'])
})

test('the favorites list narrows the tree and the table to favorite tracks, and says when there are none', async () => {
  const { model } = setup()
  const { getByTestId, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  fireEvent.click(getByTestId('list-favorites'))
  expect(
    await findByText('No favorite tracks yet. Add one from a track’s menu.'),
  ).toBeTruthy()

  act(() => {
    model.addToFavorites('genes')
  })
  expect(getByTestId('list-favorites').textContent).toBe('Favorites 1')
  expect(model.listedTrackConfigurations.map(t => t.trackId)).toEqual(['genes'])
  expect(
    model.rows.flatMap(({ item }) =>
      item.type === 'track' ? [item.trackId] : [],
    ),
  ).toEqual(['genes'])
})
