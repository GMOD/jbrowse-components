import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
import { observer } from 'mobx-react'

import { trackTableModelFactory } from '../trackTableModel.ts'
import TrackTableGrid from './TrackTableGrid.tsx'

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
        fields={table.shownColumns(9)}
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

test('clicking a name shows then hides the track, as a click on its label does in the tree', async () => {
  const { view, model, table } = setup()
  const { getByText } = renderGrid(model, table)

  fireEvent.click(getByText('fooC'))
  await waitFor(() => {
    expect([...model.shownTrackIds]).toEqual(['fooC'])
  })
  fireEvent.click(getByText('fooC'))
  await waitFor(() => {
    expect(view.tracks.length).toBe(0)
  })
  expect(model.selection.length).toBe(0)
})

test('opening a track menu from its name does not toggle the track', () => {
  const { view, model, table } = setup()
  const { getByTestId } = renderGrid(model, table)
  fireEvent.click(getByTestId('htsTrackEntryMenu-fooC'))
  expect(view.tracks.length).toBe(0)
  expect(model.shownTrackIds.size).toBe(0)
})

test('a name shows its description in a styled tooltip, not a native title', async () => {
  const { session, model, table } = setup()
  session.addSessionTrackConf({
    trackId: 'described',
    name: 'described',
    description: 'a description',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const { getByText, findByRole } = renderGrid(model, table)
  expect(getByText('described').closest('[title]')).toBeNull()
  fireEvent.mouseOver(getByText('described'))
  expect((await findByRole('tooltip')).textContent).toBe('a description')
})

test('a cut-off name shows in full on hover, and a name that fits opens nothing', async () => {
  const { model, table } = setup()
  const { getByText, findByRole, queryByRole } = renderGrid(model, table)
  fireEvent.mouseOver(getByText('fooC'))
  await new Promise(resolve => setTimeout(resolve, 800))
  expect(queryByRole('tooltip')).toBeNull()

  const clip = getByText('barC').closest('[data-clip]')!
  Object.defineProperties(clip, {
    scrollWidth: { value: 200 },
    clientWidth: { value: 100 },
  })
  fireEvent.mouseOver(getByText('barC'))
  expect((await findByRole('tooltip')).textContent).toBe('barC')
})

test('show-all appears only while a filter narrows the list, and shows what it kept', async () => {
  const { view, model, table } = setup()
  const { queryByLabelText, getByLabelText } = renderGrid(model, table)
  expect(queryByLabelText('Show all matching tracks')).toBeNull()

  act(() => {
    table.setFilterText('fooC')
  })
  fireEvent.click(getByLabelText('Show all matching tracks'))
  await waitFor(() => {
    expect(view.tracks.map(t => t.configuration.trackId)).toEqual(['fooC'])
  })
  expect(model.selection.length).toBe(0)
})

test('show-all reads as mixed while only some matching tracks are shown', async () => {
  const { model, table } = setup()
  const { getByLabelText } = renderGrid(model, table)
  act(() => {
    table.setFilterText('C')
  })
  expect(getByLabelText('Show all matching tracks')).not.toBePartiallyChecked()
  fireEvent.click(getByLabelText('Show fooC'))
  await waitFor(() => {
    expect(getByLabelText('Show all matching tracks')).toBePartiallyChecked()
  })
})

test('ctrl-click on a name adds the track to the selection without showing it', () => {
  const { view, model, table } = setup()
  const { getByText } = renderGrid(model, table)
  fireEvent.click(getByText('fooC'), { ctrlKey: true })
  expect(model.selection.map(c => c.trackId)).toEqual(['fooC'])
  expect(view.tracks.length).toBe(0)
  fireEvent.click(getByText('fooC'), { metaKey: true })
  expect(model.selection.length).toBe(0)
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
  const header = () => getByRole('columnheader', { name: 'Name' })
  expect(header().getAttribute('title')).toBe('Name')
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
  expect(queryByRole('columnheader', { name: 'Kind' })).toBeNull()
  expect(queryByRole('columnheader', { name: 'Adapter' })).toBeTruthy()
})

test('the name column keeps two thirds of the measured width before the others share', () => {
  const { session, model, table } = setup()
  session.addSessionTrackConf({
    trackId: 'long',
    name: 'A track name long enough to want far more than two thirds of the grid, and then some',
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
  ).toBeGreaterThan((448 - checkbox) * 0.6)
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

test('a placeholder track cannot be turned on, and show-all leaves it out', async () => {
  const { session, model, table } = setup()
  session.addSessionTrackConf({
    trackId: 'placeholder',
    name: '<i>legacy</i> track (Unsupported)',
    assemblyNames: ['volMyt1'],
    type: 'FeatureTrack',
    adapter: { type: 'FromConfigAdapter', features: [] },
  })
  const { getByLabelText } = renderGrid(model, table)
  const placeholder = getByLabelText('Show legacy track (Unsupported)')
  expect(placeholder).toBeDisabled()
  expect(getByLabelText('Show fooC')).toBeEnabled()

  act(() => {
    table.setFilterText('C')
  })
  fireEvent.click(getByLabelText('Show all matching tracks'))
  await waitFor(() => {
    expect(getByLabelText('Show all matching tracks')).toBeChecked()
  })
  expect(model.shownTrackIds.has('placeholder')).toBe(false)
})

test('a scroll re-renders no row checkbox, and a toggle re-renders its own', async () => {
  const { model, table } = setup()
  const { container, getByLabelText } = renderGrid(model, table)
  const labels = ['Show fooC', 'Show barC']
  const mounted = labels.map(checkboxRenders)
  expect(mounted.every(n => n > 0)).toBe(true)

  const scroller = container.querySelector('table')!.parentElement!
  for (const top of [10, 20, 30]) {
    scroller.scrollTop = top
    fireEvent.scroll(scroller)
  }
  expect(labels.map(checkboxRenders)).toEqual(mounted)

  fireEvent.click(getByLabelText('Show fooC'))
  await waitFor(() => {
    expect(getByLabelText('Show fooC')).toBeChecked()
  })
  expect(checkboxRenders('Show fooC')).toBeGreaterThan(mounted[0]!)
})
