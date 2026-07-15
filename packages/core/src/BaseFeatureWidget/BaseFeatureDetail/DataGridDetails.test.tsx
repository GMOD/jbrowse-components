import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import DataGridDetails from './DataGridDetails.tsx'
import { createJBrowseTheme } from '../../ui/index.ts'

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>{ui}</ThemeProvider>,
  )
}

describe('DataGridDetails', () => {
  test('renders without crashing for basic rows', () => {
    const { getByText } = renderWithTheme(
      <DataGridDetails
        name="transcripts"
        value={[
          { name: 'tx1', score: 'high' },
          { name: 'tx2', score: 'low' },
        ]}
      />,
    )
    // field name label renders
    expect(getByText('transcripts')).toBeTruthy()
  })

  test('numeric zero cell value renders as "0" not empty', () => {
    const { getByText } = renderWithTheme(
      <DataGridDetails
        name="variants"
        value={[
          { allele: 'A', count: '0' },
          { allele: 'T', count: '5' },
        ]}
      />,
    )
    expect(getByText('variants')).toBeTruthy()
  })

  test('uses row index as id (no clashes from duplicate id field)', () => {
    // if id field in data was reused as DataGrid id, duplicate ids would crash
    const { getByText } = renderWithTheme(
      <DataGridDetails
        name="hits"
        value={[
          { id: 'same', label: 'first' },
          { id: 'same', label: 'second' },
        ]}
      />,
    )
    expect(getByText('hits')).toBeTruthy()
  })

  test('rows carrying both id and identifier do not produce a duplicate column', () => {
    // the previous id->identifier rename collided when both keys were present
    const { getByText } = renderWithTheme(
      <DataGridDetails
        name="both"
        value={[
          { id: 'a', identifier: 'x', label: 'first' },
          { id: 'b', identifier: 'y', label: 'second' },
        ]}
      />,
    )
    expect(getByText('both')).toBeTruthy()
  })
})
