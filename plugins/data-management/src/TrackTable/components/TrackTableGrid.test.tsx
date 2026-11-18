import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
import { observer } from 'mobx-react'

import { trackTableModelFactory } from '../trackTableModel.ts'
import TrackTableGrid from './TrackTableGrid.tsx'
import { getTableColumns } from './getTableColumns.tsx'

import type * as CheckboxLiteModule from '../../HierarchicalTrackSelectorWidget/components/tree/CheckboxLite.tsx'
import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackTableModel } from '../trackTableModel.ts'
import type { createElement } from 'react'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const mockCheckboxRender = jest.fn<undefined, [string | undefined]>()
jest.mock(
  '../../HierarchicalTrackSelectorWidget/components/tree/CheckboxLite.tsx',
  () => {
    const { createElement: create } = jest.requireActual<{
      createElement: typeof createElement
    }>('react')
    const { default: CheckboxLite } = jest.requireActual<
      typeof CheckboxLiteModule
    >('../../HierarchicalTrackSelectorWidget/components/tree/CheckboxLite.tsx')
    return {
      __esModule: true,
      default: (props: React.ComponentProps<typeof CheckboxLite>) => {
        mockCheckboxRender(props.label)
        return create(CheckboxLite, props)
      },
    }
  },
)

function checkboxRenders(label: string) {
  return mockCheckboxRender.mock.calls.filter(([l]) => l === label).length
}

// jsdom doesn't implement Element.scrollTo, which useVirtualRows calls when the
// search, filters or sort change
const scrollTo = jest.fn()
beforeAll(() => {
  Element.prototype.scrollTo = scrollTo
})

afterEach(() => {
  mockCheckboxRender.mockClear()
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
  const table = trackTableModelFactory().create({})
  table.setTrackSource(
    () => model.allTrackConfigurations,
    getSession(model),
    model.assemblyNames,
  )
  return { session, view, model, table }
}

function renderGrid(
  model: HierarchicalTrackSelectorModel,
  table: TrackTableModel,
) {
  const Wrapper = observer(function Wrapper() {
    return (
      <TrackTableGrid
        model={model}
        table={table}
        columns={getTableColumns({
          table,
          model,
          fields: table.shownColumns(9),
        })}
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
  const { model, table } = setup()
  const { getByText } = renderGrid(model, table)
  expect(getByText('fooC')).toBeTruthy()
  expect(getByText('barC')).toBeTruthy()
})

test('clicking a row checkbox shows then hides the track on the view', async () => {
  const { view, model, table } = setup()
  const { getByText } = renderGrid(model, table)

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
  const { view, model, table } = setup()
  const { queryByLabelText, getByLabelText } = renderGrid(model, table)
  expect(queryByLabelText('Select all tracks')).toBeNull()

  act(() => {
    table.setUseShoppingCart(true)
  })
  fireEvent.click(getByLabelText('Select all tracks'))
  expect(model.selection.length).toBe(table.filteredRows.length)
  expect(view.tracks.length).toBe(0)
})

test('shows an empty message when nothing matches the filter', () => {
  const { model, table } = setup()
  table.setFilterText('no-such-track-zzz')
  const { getByText, queryByText } = renderGrid(model, table)
  expect(
    getByText('No tracks match the current search and filters'),
  ).toBeTruthy()
  expect(queryByText('fooC')).toBeNull()
})

test('a header names its column in full on hover, and a click cycles ascending, descending, unsorted', () => {
  const { model, table } = setup()
  const { getByRole } = renderGrid(model, table)
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
  expect(table.sortField).toBe('')
})

test('a column the user hid is not rendered, and one they showed is', () => {
  const { model, table } = setup()
  table.setColumnVisible('kind', false)
  table.setColumnVisible('adapter', true)
  const { queryByRole } = renderGrid(model, table)
  expect(queryByRole('columnheader', { name: 'kind' })).toBeNull()
  expect(queryByRole('columnheader', { name: 'adapter' })).toBeTruthy()
})

test('the name column keeps half the measured width before the others share', () => {
  const { session, model, table } = setup()
  session.addSessionTrackConf({
    trackId: 'long',
    name: 'A track name long enough to want far more than half of the grid',
    description: 'A description long enough to want the whole grid to itself',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  table.setColumnVisible('description', true)
  table.setColumnVisible('adapter', true)
  const clientWidth = jest
    .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockReturnValue(448)
  const { container } = renderGrid(model, table)
  const [checkbox = 0, , ...rest] = [...container.querySelectorAll('col')].map(
    col => Number.parseFloat(col.style.width) || 0,
  )
  const tableMinWidth = Number.parseFloat(
    container.querySelector('table')!.style.minWidth,
  )
  clientWidth.mockRestore()
  expect(
    tableMinWidth - checkbox - rest.reduce((a, b) => a + b, 0),
  ).toBeGreaterThanOrEqual((448 - checkbox) / 2)
})

test('the name column takes the room the other columns leave', () => {
  const { model, table } = setup()
  const { container } = renderGrid(model, table)
  const cols = [...container.querySelectorAll('col')]
  expect(cols[1]!.style.width).toBe('')
  expect(cols.slice(2).every(col => col.style.width !== '')).toBe(true)
  expect(container.querySelector('table')!.style.minWidth).not.toBe('')
})

test('the grid scrolls back to the top when the search, filters or sort change, not when a track goes', () => {
  const { session, model, table } = setup()
  const { container } = renderGrid(model, table)
  const scroller = container.querySelector('table')!.parentElement!
  function scrollDown() {
    scroller.scrollTop = 100
    fireEvent.scroll(scroller)
  }
  scrollTo.mockClear()

  scrollDown()
  act(() => {
    session.deleteTrackConf(
      session.sessionTracks.find(t => t.trackId === 'fooC')!,
    )
  })
  expect(table.allRows.map(r => r.id)).not.toContain('fooC')
  expect(scrollTo).not.toHaveBeenCalled()

  act(() => {
    table.setFilterText('bar')
  })
  scrollDown()
  act(() => {
    table.setFilter('kind', ['Feature'])
  })
  scrollDown()
  act(() => {
    table.setSort('name', false)
  })
  expect(scrollTo).toHaveBeenCalledTimes(3)
})

test('a change while the grid is already at the top scrolls nothing', () => {
  const { model, table } = setup()
  renderGrid(model, table)
  scrollTo.mockClear()
  act(() => {
    table.setFilterText('bar')
  })
  expect(scrollTo).not.toHaveBeenCalled()
})

test('a placeholder track cannot be turned on, and select-all leaves it out', () => {
  const { session, view, model, table } = setup()
  session.addSessionTrackConf({
    trackId: 'placeholder',
    name: '<i>legacy</i> track (Unsupported)',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const { getByLabelText } = renderGrid(model, table)
  const placeholder = getByLabelText('Select legacy track (Unsupported)')
  expect(placeholder).toBeDisabled()
  expect(getByLabelText('Select fooC')).toBeEnabled()
  fireEvent.click(placeholder)
  expect(view.tracks.length).toBe(0)

  act(() => {
    table.setUseShoppingCart(true)
  })
  fireEvent.click(getByLabelText('Select all tracks'))
  expect(model.selectionSet.has('fooC')).toBe(true)
  expect(model.selectionSet.has('placeholder')).toBe(false)
  expect(getByLabelText('Select all tracks')).toBeChecked()
})

test('a scroll re-renders no row checkbox, and a toggle re-renders its own', async () => {
  const { model, table } = setup()
  const { container, getByLabelText } = renderGrid(model, table)
  const labels = ['Select fooC', 'Select barC']
  const mounted = labels.map(checkboxRenders)
  expect(mounted.every(n => n > 0)).toBe(true)

  const scroller = container.querySelector('table')!.parentElement!
  for (const top of [10, 20, 30]) {
    scroller.scrollTop = top
    fireEvent.scroll(scroller)
  }
  expect(labels.map(checkboxRenders)).toEqual(mounted)

  fireEvent.click(getByLabelText('Select fooC'))
  await waitFor(() => {
    expect(getByLabelText('Select fooC')).toBeChecked()
  })
  expect(checkboxRenders('Select fooC')).toBeGreaterThan(mounted[0]!)
})
