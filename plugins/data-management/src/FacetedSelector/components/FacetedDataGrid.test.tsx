import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
import { observer } from 'mobx-react'

import { facetedStateTreeF } from '../facetedModel.ts'
import FacetedDataGrid from './FacetedDataGrid.tsx'
import { getFacetedColumns } from './getFacetedColumns.tsx'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// jsdom doesn't implement Element.scrollTo, which useVirtualRows calls when the
// search, filters or sort change
const scrollTo = jest.fn()
beforeAll(() => {
  Element.prototype.scrollTo = scrollTo
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
  for (const trackId of ['fooC', 'barC']) {
    session.addSessionTrackConf({
      trackId,
      name: trackId,
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
  return { session, view, model, faceted }
}

function renderGrid(
  model: HierarchicalTrackSelectorModel,
  faceted: FacetedModel,
) {
  const columns = getFacetedColumns({ faceted, model })
  // observer wrapper mirrors FacetedSelector: re-reads shownTrackIds/selection
  // from the live model so the grid sees updates after a toggle
  const Wrapper = observer(function Wrapper() {
    return (
      <FacetedDataGrid
        model={model}
        faceted={faceted}
        columns={columns}
        shownTrackIds={model.shownTrackIds}
        selectionSet={model.selectionSet}
        width={1200}
      />
    )
  })
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Wrapper />
    </ThemeProvider>,
  )
}

test('renders a row per track', () => {
  const { model, faceted } = setup()
  const { getByText } = renderGrid(model, faceted)
  expect(getByText('fooC')).toBeTruthy()
  expect(getByText('barC')).toBeTruthy()
})

test('clicking a row checkbox shows then hides the track on the view', async () => {
  const { view, model, faceted } = setup()
  const { getByText } = renderGrid(model, faceted)

  const row = getByText('fooC').closest('tr')!
  const checkbox = within(row).getByRole('checkbox')

  expect(view.tracks.length).toBe(0)
  fireEvent.click(checkbox)
  // the show goes through the async launchTrack path now
  await waitFor(() => {
    expect([...model.shownTrackIds]).toEqual(['fooC'])
  })
  fireEvent.click(checkbox)
  await waitFor(() => {
    expect(view.tracks.length).toBe(0)
  })
})

test('select-all adds every filtered track to the selection, and only in add-to-selection mode', () => {
  const { view, model, faceted } = setup()
  const { queryByLabelText, getByLabelText } = renderGrid(model, faceted)
  expect(queryByLabelText('Select all tracks')).toBeNull()

  act(() => {
    faceted.setUseShoppingCart(true)
  })
  fireEvent.click(getByLabelText('Select all tracks'))
  expect(model.selection.length).toBe(faceted.filteredRows.length)
  expect(view.tracks.length).toBe(0)
})

test('shows an empty message when nothing matches the filter', () => {
  const { model, faceted } = setup()
  faceted.setFilterText('no-such-track-zzz')
  const { getByText, queryByText } = renderGrid(model, faceted)
  expect(
    getByText('No tracks match the current search and filters'),
  ).toBeTruthy()
  expect(queryByText('fooC')).toBeNull()
})

test('a header names its column in full on hover, and a click cycles ascending, descending, unsorted', () => {
  const { model, faceted } = setup()
  const { getByRole } = renderGrid(model, faceted)
  const header = () => getByRole('columnheader', { name: 'name' })
  expect(header().getAttribute('title')).toBe('name')
  expect(header().getAttribute('aria-sort')).toBeNull()

  const click = () => {
    fireEvent.click(within(header()).getByRole('button'))
  }
  click()
  expect(header().getAttribute('aria-sort')).toBe('ascending')
  click()
  expect(header().getAttribute('aria-sort')).toBe('descending')
  click()
  expect(header().getAttribute('aria-sort')).toBeNull()
  expect(faceted.sortField).toBe('')
})

test('a column hidden via visible is not rendered', () => {
  const { model, faceted } = setup()
  faceted.setShowSparse(true)
  // surface the adapter column, then hide it
  faceted.setColumnVisible('adapter', false)
  const { queryByText } = renderGrid(model, faceted)
  // the adapter header should be gone, but tracks still render
  expect(queryByText('adapter')).toBeNull()
  expect(queryByText('fooC')).toBeTruthy()
})

test('the grid scrolls back to the top when the search, filters or sort change, not when a track goes', () => {
  const { session, model, faceted } = setup()
  renderGrid(model, faceted)
  scrollTo.mockClear()

  act(() => {
    session.deleteTrackConf(
      session.sessionTracks.find(t => t.trackId === 'fooC')!,
    )
  })
  expect(faceted.allRows.map(r => r.id)).not.toContain('fooC')
  expect(scrollTo).not.toHaveBeenCalled()

  act(() => {
    faceted.setFilterText('bar')
  })
  act(() => {
    faceted.setFilter('kind', ['Feature'])
  })
  act(() => {
    faceted.setSort('name', false)
  })
  expect(scrollTo).toHaveBeenCalledTimes(3)
})
