import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render } from '@testing-library/react'

import { trackTableModelFactory } from '../trackTableModel.ts'
import FacetFilter from './FacetFilter.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function tableOf(metadata: Record<string, string>[]) {
  const tracks = metadata.map((m, i) => ({
    trackId: `t${i}`,
    name: `track ${i}`,
    type: 'FeatureTrack',
    metadata: m,
  }))
  const table = trackTableModelFactory().create({})
  table.setTrackSource(() => tracks, createTestSession(), [])
  return table
}

function renderFacet(
  table: ReturnType<typeof tableOf>,
  field: string,
  defaultExpanded?: boolean,
) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FacetFilter
        field={field}
        table={table}
        defaultExpanded={defaultExpanded}
      />
    </ThemeProvider>,
  )
}

function assayTable() {
  return tableOf([
    { assay: 'DNA', lab: 'x' },
    { assay: 'DNA', lab: 'y' },
    { assay: 'RNA', lab: 'y' },
  ])
}

function renderFilter() {
  const table = assayTable()
  return { table, ...renderFacet(table, 'metadata.assay') }
}

test('checking values stores them as a string array, in click order', () => {
  const { table, getByLabelText } = renderFilter()

  fireEvent.click(getByLabelText('RNA'))
  fireEvent.click(getByLabelText('DNA'))

  expect(table.filters.get('metadata.assay')).toEqual(['RNA', 'DNA'])
})

test('unchecking a value removes only that value', () => {
  const { table, getByLabelText } = renderFilter()
  act(() => {
    table.setFilter('metadata.assay', ['DNA', 'RNA'])
  })

  fireEvent.click(getByLabelText('DNA'))

  expect(table.filters.get('metadata.assay')).toEqual(['RNA'])
})

test('each value shows its count, and clearing appears once one is checked', () => {
  const { table, getByLabelText, queryByLabelText } = renderFilter()
  expect(getByLabelText('DNA').closest('label')!.textContent).toBe('DNA2')
  expect(queryByLabelText('Clear Assay filter')).toBeNull()

  fireEvent.click(getByLabelText('DNA'))
  fireEvent.click(getByLabelText('Clear Assay filter'))

  expect(table.filters.has('metadata.assay')).toBe(false)
})

test('a facet the search leaves no value in says so', () => {
  const { table, getByText, queryByText, queryByLabelText } = renderFilter()
  expect(queryByText('No matching values')).toBeNull()

  act(() => {
    table.setFilterText('nosuchtrack')
  })

  expect(queryByLabelText('DNA')).toBeNull()
  expect(getByText('No matching values')).toBeTruthy()
})

function renderValues(count: number, defaultExpanded?: boolean) {
  const table = tableOf(
    Array.from({ length: count }, (_, i) =>
      Array.from({ length: count - i }, () => ({ cell: `c${i}` })),
    ).flat(),
  )
  return { table, ...renderFacet(table, 'metadata.cell', defaultExpanded) }
}

test('a facet of up to 20 values lists them all', () => {
  const { getByLabelText, queryByText } = renderValues(20)
  expect(getByLabelText('c19')).toBeTruthy()
  expect(queryByText(/more$/)).toBeNull()
})

test('a longer facet lists its 10 most common values, any checked one, and a way to the rest', () => {
  const { table, getByText, queryByLabelText, getByLabelText } =
    renderValues(25)
  expect(getByLabelText('c9')).toBeTruthy()
  expect(queryByLabelText('c10')).toBeNull()

  act(() => {
    table.setFilter('metadata.cell', ['c20'])
  })
  expect(getByLabelText('c20')).toBeTruthy()
  fireEvent.click(getByText('Show 14 more'))
  expect(getByLabelText('c24')).toBeTruthy()
  fireEvent.click(getByText('Show fewer'))
  expect(queryByLabelText('c24')).toBeNull()
})

test('a collapsed facet shows its heading, and opens on a click', () => {
  const { getByRole, queryByLabelText, getByLabelText } = renderValues(3, false)
  expect(queryByLabelText('c0')).toBeNull()
  fireEvent.click(getByRole('button', { name: 'Cell' }))
  expect(getByLabelText('c0')).toBeTruthy()
})

test('a facet counts its values over the tracks the other facets keep', () => {
  const { table, getByLabelText } = renderFilter()
  act(() => {
    table.setFilter('metadata.lab', ['y'])
  })
  expect(getByLabelText('DNA').closest('label')!.textContent).toBe('DNA1')
  expect(getByLabelText('RNA').closest('label')!.textContent).toBe('RNA1')
})

test('a collapsed facet lists its counts once opened, after a filter changed', () => {
  const table = assayTable()
  const { getByRole, getByLabelText, queryByLabelText } = renderFacet(
    table,
    'metadata.assay',
    false,
  )
  act(() => {
    table.setFilter('metadata.lab', ['x'])
  })
  fireEvent.click(getByRole('button', { name: 'Assay' }))
  expect(getByLabelText('DNA').closest('label')!.textContent).toBe('DNA1')
  expect(queryByLabelText('RNA')).toBeNull()
})
