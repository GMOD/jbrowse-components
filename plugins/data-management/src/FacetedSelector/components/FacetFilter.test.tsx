import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { act, fireEvent, render } from '@testing-library/react'

import { facetedStateTreeF } from '../facetedModel.ts'
import FacetFilter from './FacetFilter.tsx'

function renderFilter() {
  const faceted = facetedStateTreeF().create({})
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FacetFilter
        field="metadata.assay"
        vals={[
          ['DNA', 2],
          ['RNA', 1],
        ]}
        faceted={faceted}
      />
    </ThemeProvider>,
  )
  return { faceted, ...utils }
}

test('checking values stores them as a string array, in click order', () => {
  const { faceted, getByLabelText } = renderFilter()

  fireEvent.click(getByLabelText('RNA'))
  fireEvent.click(getByLabelText('DNA'))

  expect(faceted.filters.get('metadata.assay')).toEqual(['RNA', 'DNA'])
})

test('unchecking a value removes only that value', () => {
  const { faceted, getByLabelText } = renderFilter()
  act(() => {
    faceted.setFilter('metadata.assay', ['DNA', 'RNA'])
  })

  fireEvent.click(getByLabelText('DNA'))

  expect(faceted.filters.get('metadata.assay')).toEqual(['RNA'])
})

test('each value shows its count, and clearing appears once one is checked', () => {
  const { faceted, getByLabelText, queryByLabelText } = renderFilter()
  expect(getByLabelText('DNA').closest('label')!.textContent).toBe('DNA2')
  expect(queryByLabelText('Clear assay filter')).toBeNull()

  fireEvent.click(getByLabelText('DNA'))
  fireEvent.click(getByLabelText('Clear assay filter'))

  expect(faceted.filters.has('metadata.assay')).toBe(false)
})

function renderValues(count: number, defaultExpanded?: boolean) {
  const faceted = facetedStateTreeF().create({})
  const vals = Array.from(
    { length: count },
    (_, i) => [`c${i}`, 100 - i] satisfies [string, number],
  )
  return {
    faceted,
    ...render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <FacetFilter
          field="metadata.cell"
          vals={vals}
          faceted={faceted}
          defaultExpanded={defaultExpanded}
        />
      </ThemeProvider>,
    ),
  }
}

test('a facet of up to 20 values lists them all', () => {
  const { getByLabelText, queryByText } = renderValues(20)
  expect(getByLabelText('c19')).toBeTruthy()
  expect(queryByText(/more$/)).toBeNull()
})

test('a longer facet lists its 10 most common values, any checked one, and a way to the rest', () => {
  const { faceted, getByText, queryByLabelText, getByLabelText } =
    renderValues(25)
  expect(getByLabelText('c9')).toBeTruthy()
  expect(queryByLabelText('c10')).toBeNull()

  act(() => {
    faceted.setFilter('metadata.cell', ['c20'])
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
  fireEvent.click(getByRole('button', { name: 'cell' }))
  expect(getByLabelText('c0')).toBeTruthy()
})
