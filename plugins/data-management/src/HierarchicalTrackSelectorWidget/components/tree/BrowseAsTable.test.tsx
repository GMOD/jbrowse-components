import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, waitFor } from '@testing-library/react'

import HierarchicalTrackSelector from '../HierarchicalTrackSelector.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

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

test('the link names the tree query', async () => {
  const { model } = setup()
  const { getByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )
  const button = getByTestId('browse-as-table')
  expect(button.textContent).toBe('Browse as a table')
  model.setFilterText(' chrom ')
  await waitFor(() => {
    expect(button.textContent).toBe('Search “chrom” in the table')
  })
})

test('the table replaces the tree, seeded with the query and with facets hidden, and going back restores the tree', async () => {
  const { model } = setup()
  model.setFilterText(' chrom ')
  const {
    getByTestId,
    findByLabelText,
    findAllByText,
    queryByText,
    queryByLabelText,
  } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <HierarchicalTrackSelector model={model} />
    </ThemeProvider>,
  )

  fireEvent.click(getByTestId('browse-as-table'))
  const search = await findByLabelText('Filter tracks')
  expect((search as HTMLInputElement).value).toBe(' chrom ')
  expect(queryByText('Browse as a table')).toBeNull()
  expect(queryByText('Clear all filters')).toBeNull()
  expect(queryByLabelText('Select all tracks')).toBeNull()

  fireEvent.click(getByTestId('back-to-tree'))
  expect(await findAllByText('Search “chrom” in the table')).toHaveLength(1)
  expect(document.activeElement).toBe(getByTestId('browse-as-table'))
})

test('the table widens the drawer without touching the saved width, a drag resizes the table width, and closing returns to the saved one', () => {
  const { session, model } = setup()
  session.updateDrawerWidth(400, 2000)

  model.openTable({ width: 400, availableWidth: 2000 })
  expect(session.effectiveDrawerWidth).toBe(900)
  expect(session.drawerWidth).toBe(400)

  session.updateDrawerWidth(1000, 2000)
  expect(session.effectiveDrawerWidth).toBe(1000)
  expect(session.drawerWidth).toBe(400)

  model.closeTable()
  expect(session.effectiveDrawerWidth).toBe(400)
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
