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

  expect(faceted.filters.get('metadata.assay')).toEqual([])
})

test('a long facet lists its most common values, any checked one, and a way to the rest', () => {
  const faceted = facetedStateTreeF().create({})
  faceted.setFilter('metadata.cell', ['c9'])
  const vals = Array.from(
    { length: 12 },
    (_, i) => [`c${i}`, 20 - i] satisfies [string, number],
  )
  const { getByText, queryByLabelText, getByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FacetFilter field="metadata.cell" vals={vals} faceted={faceted} />
    </ThemeProvider>,
  )
  expect(getByLabelText('c0')).toBeTruthy()
  expect(getByLabelText('c7')).toBeTruthy()
  expect(queryByLabelText('c8')).toBeNull()
  expect(getByLabelText('c9')).toBeTruthy()

  fireEvent.click(getByText('Show 3 more'))
  expect(getByLabelText('c11')).toBeTruthy()
  fireEvent.click(getByText('Show fewer'))
  expect(queryByLabelText('c11')).toBeNull()
})
