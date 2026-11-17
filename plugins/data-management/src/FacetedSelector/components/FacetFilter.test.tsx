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
