import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import Attributes from './Attributes.tsx'
import { createJBrowseTheme } from '../../ui/index.ts'

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>{ui}</ThemeProvider>,
  )
}

describe('Attributes', () => {
  test('renders a scalar field with its label and value', () => {
    const { getByText } = renderWithTheme(
      <Attributes attributes={{ foo: 'bar' }} />,
    )
    expect(getByText('foo')).toBeTruthy()
    expect(getByText('bar')).toBeTruthy()
  })

  test('drops globally-omitted keys such as uniqueId', () => {
    const { getByText, queryByText } = renderWithTheme(
      <Attributes attributes={{ shown: 'yes', uniqueId: 'hidden' }} />,
    )
    expect(getByText('shown')).toBeTruthy()
    expect(queryByText('uniqueId')).toBeNull()
  })

  test('drops null/undefined values', () => {
    const { queryByText, getByText } = renderWithTheme(
      <Attributes attributes={{ kept: 'a', gone: null }} />,
    )
    expect(getByText('kept')).toBeTruthy()
    expect(queryByText('gone')).toBeNull()
  })

  test('__jbrowsefmt overrides the raw value for the same key', () => {
    const { getByText, queryByText } = renderWithTheme(
      <Attributes
        attributes={{ score: 'raw', __jbrowsefmt: { score: 'fmt' } }}
      />,
    )
    expect(getByText('fmt')).toBeTruthy()
    expect(queryByText('raw')).toBeNull()
  })

  test('nested object renders its label with a dotted prefix path', () => {
    const { getByText } = renderWithTheme(
      <Attributes attributes={{ outer: { inner: 'v' } }} />,
    )
    expect(getByText('outer.inner')).toBeTruthy()
  })

  test('hides URI values when hideUris is set', () => {
    const { queryByText } = renderWithTheme(
      <Attributes
        hideUris
        attributes={{ file: { uri: 'https://example.com/x' } }}
      />,
    )
    expect(queryByText('file')).toBeNull()
  })

  test('homogeneous object array renders via the data grid', () => {
    const { getByText } = renderWithTheme(
      <Attributes
        attributes={{
          transcripts: [
            { name: 'tx1', score: 'high' },
            { name: 'tx2', score: 'low' },
          ],
        }}
      />,
    )
    expect(getByText('transcripts')).toBeTruthy()
  })
})
