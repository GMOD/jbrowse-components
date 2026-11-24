import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render } from '@testing-library/react'

import { noMatchingTracksMessage } from '../../TrackTable/components/util.ts'
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

test('the ☰ menu stays in table mode', async () => {
  const { model } = setup(true)
  const { getByTestId, findByTestId, queryByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  await findByTestId('track-selector-hamburger')
  fireEvent.click(getByTestId('show-as-table'))
  expect(model.showTable).toBe(true)
  expect(queryByTestId('track-selector-hamburger')).not.toBeNull()
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
  expect(queryByLabelText('Show all matching tracks')).toBeTruthy()

  fireEvent.change(search, { target: { value: 'genes' } })
  fireEvent.click(tree)
  expect(model.showTable).toBe(false)
  expect(getByTestId('show-as-tree')).toBe(tree)
  expect(model.filterText).toBe('genes')
})

test('the table opens at the drawer width, a drag resizes the table width without touching the saved width, and closing returns to the saved one', () => {
  const { session, model } = setup()
  session.updateDrawerWidth(200, 2000)

  model.openTable(200)
  expect(session.effectiveDrawerWidth).toBe(200)

  session.updateDrawerWidth(1000, 2000)
  expect(session.effectiveDrawerWidth).toBe(1000)
  expect(session.drawerWidth).toBe(200)

  model.closeTable()
  expect(session.effectiveDrawerWidth).toBe(200)
})

test('a table opened with no drawer to measure asks for no width', () => {
  const { session, model } = setup()
  model.openTable()
  expect(model.showTable).toBe(true)
  expect(session.effectiveDrawerWidth).toBe(session.drawerWidth)
})

test('table mode stays with the view it was opened for', () => {
  const { session, model, addView } = setup()
  model.openTable(400)
  const other = addView()
  expect(other.activateTrackSelector()).toBe(model)
  expect(model.showTable).toBe(false)
  expect(session.effectiveDrawerWidth).toBe(session.drawerWidth)
})

test('closing the selector leaves table mode, so reopening it shows the tree', () => {
  const { session, model } = setup()
  model.openTable(400)
  session.hideWidget(model)
  expect(model.showTable).toBe(false)
  session.showWidget(model)
  expect(session.effectiveDrawerWidth).toBe(session.drawerWidth)
})

test('the recent list is flat, newest first, under one group row with no category tree', () => {
  const { model } = setup()
  model.addToRecentlyUsed('genes')
  model.addToRecentlyUsed('chromatin')
  model.setTrackList('recent')
  expect(
    model.rows.map(({ item }) =>
      item.type === 'track' ? item.trackId : `[${item.name}]`,
    ),
  ).toEqual(['[Recently used tracks]', 'chromatin', 'genes'])
})

test('an empty favorites list draws its group row with the message under it', () => {
  const { model } = setup()
  const { getByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  act(() => {
    model.setTrackList('favorites')
  })
  expect(model.rows.map(r => r.item.name)).toEqual(['Favorite tracks'])
  const message = getByText(
    'No favorite tracks yet. Add one from a track’s menu.',
  )
  expect(
    getByText('Favorite tracks').compareDocumentPosition(message) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})

test('the table lists the recent tracks newest first, as the tree does', () => {
  const { model } = setup()
  model.addToRecentlyUsed('genes')
  model.addToRecentlyUsed('chromatin')
  model.addToRecentlyUsed('genes')
  model.setTrackList('recent')
  model.openTable()
  expect(model.trackTable.sortedRows.map(r => r.id)).toEqual([
    'genes',
    'chromatin',
  ])
})

test('an empty favorites list says so once in table mode', async () => {
  const { model } = setup()
  model.openTable()
  const { getByTestId, findAllByText, queryByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  fireEvent.click(getByTestId('list-favorites'))
  expect(
    await findAllByText('No favorite tracks yet. Add one from a track’s menu.'),
  ).toHaveLength(1)
  expect(queryByText('No tracks')).toBeNull()
})

test('the favorites list narrows the tree and the table to favorite tracks, and says when there are none', async () => {
  const { model } = setup()
  const { getByTestId, getByLabelText, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  fireEvent.click(getByTestId('list-favorites'))
  const message = await findByText(
    'No favorite tracks yet. Add one from a track’s menu.',
  )
  // where the rows go, so the filter row above it does not move
  expect(
    getByLabelText('Filter tracks').compareDocumentPosition(message) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()

  act(() => {
    model.addToFavorites('genes')
  })
  expect(model.listedTrackConfigurations.map(t => t.trackId)).toEqual(['genes'])
  expect(
    model.rows.flatMap(({ item }) =>
      item.type === 'track' ? [item.trackId] : [],
    ),
  ).toEqual(['genes'])
})

test('a tree the filter empties says no tracks match, in the table’s words', () => {
  const { model } = setup()
  const { queryByText, getByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  act(() => {
    model.setFilterText('genes')
  })
  expect(queryByText(noMatchingTracksMessage)).toBeNull()

  act(() => {
    model.setFilterText('nosuchtrack')
  })
  expect(model.rows).toEqual([])
  const message = queryByText(noMatchingTracksMessage)
  expect(
    message &&
      getByLabelText('Filter tracks').compareDocumentPosition(message) &
        Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})

test('the ☰ menu clears the favorites only while that list shows, and Undo puts them back', async () => {
  const { session, model } = setup()
  model.addToFavorites('genes')
  model.addToFavorites('chromatin')
  const { getByTestId, findByText, queryByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  fireEvent.click(getByTestId('track-selector-hamburger'))
  await findByText('Add track...')
  expect(queryByText('Clear favorites')).toBeNull()
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })

  fireEvent.click(getByTestId('list-favorites'))
  fireEvent.click(getByTestId('track-selector-hamburger'))
  fireEvent.click(await findByText('Clear favorites'))
  expect(model.favorites).toEqual([])

  act(() => {
    session.snackbarMessages.at(-1)?.actions?.[0]?.onClick()
  })
  expect(model.favorites).toEqual(['genes', 'chromatin'])
})

test('a favorites list none of whose tracks this view can show says so', async () => {
  const { model } = setup()
  model.addToFavorites('a-track-on-another-genome')
  const { getByTestId, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  fireEvent.click(getByTestId('list-favorites'))
  expect(
    await findByText(
      'None of your favorite tracks can show in this view. Add one from a track’s menu.',
    ),
  ).toBeTruthy()
})

test('the list toggles switch between all tracks, favorites and recent, and pressing the one on keeps it', () => {
  const { model } = setup()
  const { getByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  expect(getByTestId('list-all').getAttribute('aria-pressed')).toBe('true')
  const recent = getByTestId('list-recent')
  fireEvent.click(recent)
  expect(model.trackList).toBe('recent')
  fireEvent.click(recent)
  expect(model.trackList).toBe('recent')

  fireEvent.click(getByTestId('list-favorites'))
  expect(model.trackList).toBe('favorites')
  fireEvent.click(getByTestId('list-all'))
  expect(model.trackList).toBe('all')
  expect(getByTestId('list-recent')).toBe(recent)
})

test('in table mode a button slides the drawer out wide to show every column, and back to the width it had', () => {
  const { model } = setup()
  const { getByTestId, queryByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <div data-testid="drawer-row">
        <div data-drawer-column>
          <HierarchicalTrackSelector model={model} />
        </div>
      </div>
    </ThemeProvider>,
  )
  Object.defineProperty(getByTestId('drawer-row'), 'clientWidth', {
    value: 1500,
  })
  expect(queryByTestId('table-bump-out')).toBeNull()

  act(() => {
    model.openTable(400)
  })
  fireEvent.click(getByTestId('table-bump-out'))
  expect(model.tableWide).toBe(true)
  expect(model.preferredDrawerWidth).toBe(1200)
  expect(model.trackTable.wideColumns).toContain('description')

  fireEvent.click(getByTestId('table-bump-out'))
  expect(model.tableWide).toBe(false)
  expect(model.preferredDrawerWidth).toBe(400)
})
