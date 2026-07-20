import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, within } from '@testing-library/react'
import { observer } from 'mobx-react'

import { facetedStateTreeF } from '../facetedModel.ts'
import FacetedDataGrid from './FacetedDataGrid.tsx'
import { getFacetedColumns } from './getFacetedColumns.tsx'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// jsdom doesn't implement Element.scrollTo, which useVirtualRows calls on
// filter/count change
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
  for (const trackId of ['fooC', 'barC']) {
    session.addTrackConf({
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
  faceted.setTrackConfigurations(
    model.allTrackConfigurations,
    getSession(model),
    model.assemblyNames,
  )
  return { view, model, faceted }
}

function renderGrid(
  model: HierarchicalTrackSelectorModel,
  faceted: FacetedModel,
) {
  const columns = getFacetedColumns({ faceted, model, nameClassName: 'name' })
  // observer wrapper mirrors FacetedSelector: re-reads shownTrackIds/selection
  // from the live model so the grid sees updates after a toggle
  const Wrapper = observer(function Wrapper() {
    return (
      <FacetedDataGrid
        model={model}
        faceted={faceted}
        columns={columns}
        shownTrackIds={model.shownTrackIds}
        selection={model.selection}
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

test('clicking a row checkbox shows then hides the track on the view', () => {
  const { view, model, faceted } = setup()
  const { getByText } = renderGrid(model, faceted)

  const row = getByText('fooC').closest('tr')!
  const checkbox = within(row).getByRole('checkbox')

  expect(view.tracks.length).toBe(0)
  fireEvent.click(checkbox)
  expect([...model.shownTrackIds]).toEqual(['fooC'])
  fireEvent.click(checkbox)
  expect(view.tracks.length).toBe(0)
})

test('select-all checkbox shows every filtered track', () => {
  const { view, model, faceted } = setup()
  const { getAllByRole } = renderGrid(model, faceted)

  // the first checkbox is the header select-all
  fireEvent.click(getAllByRole('checkbox')[0]!)
  expect(view.tracks.length).toBe(faceted.filteredRows.length)
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
