import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import FacetFilter from './FacetFilter.tsx'
import { facetedStateTreeF } from '../facetedModel.ts'

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

test('selecting an option stores the value as a string array', () => {
  const { faceted, container } = renderFilter()
  const select = container.querySelector('select')!

  fireEvent.change(select, { target: { value: 'DNA' } })

  // regression: native multiple select must yield string[], not a string that
  // would later be spread into a per-character Set
  expect(faceted.filters.get('metadata.assay')).toEqual(['DNA'])
})

test('multiple selected options are all captured', () => {
  const { faceted, container } = renderFilter()
  const select = container.querySelector('select')!
  for (const option of select.options) {
    option.selected = true
  }

  fireEvent.change(select)

  expect(faceted.filters.get('metadata.assay')).toEqual(['DNA', 'RNA'])
})
