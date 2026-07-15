import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import VariantConsequenceDataGrid from './VariantConsequenceDataGrid.tsx'

function renderGrid(props: {
  data: string[]
  fields: string[]
  title: string
}) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <VariantConsequenceDataGrid {...props} />
    </ThemeProvider>,
  )
}

test('renders the ANN table when the header supplies column names', () => {
  const { getByText, queryByText } = renderGrid({
    title: 'Variant ANN field',
    fields: ['Allele', 'Annotation', 'Annotation_Impact'],
    data: ['T|stop_gained|HIGH'],
  })
  expect(getByText('Variant ANN field')).toBeTruthy()
  expect(queryByText('No columns')).toBeNull()
})

// Regression: a variant that carries ANN data but whose header column names
// never reached the widget used to render a headerless empty "No columns"
// grid. With no resolvable columns the card is suppressed entirely.
test('renders nothing when data is present but column names are missing', () => {
  const { container, queryByText } = renderGrid({
    title: 'Variant ANN field',
    fields: [],
    data: ['T|stop_gained|HIGH'],
  })
  expect(container.firstChild).toBeNull()
  expect(queryByText('Variant ANN field')).toBeNull()
})

test('renders nothing when there is no ANN data', () => {
  const { container } = renderGrid({
    title: 'Variant ANN field',
    fields: ['Allele', 'Annotation'],
    data: [],
  })
  expect(container.firstChild).toBeNull()
})
