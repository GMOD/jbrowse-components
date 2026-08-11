import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import { createJBrowseTheme } from '../../ui/index.ts'
import Attributes from './Attributes.tsx'

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

  // regression: only UriLocation was suppressed, so a desktop or
  // `--load copy` config printed the full path under hideUris
  test('hides local path values when hideUris is set', () => {
    const { queryByText } = renderWithTheme(
      <Attributes
        hideUris
        attributes={{
          file: {
            localPath: '/home/someone/secret/x.bam',
            locationType: 'LocalPathLocation',
          },
        }}
      />,
    )
    expect(queryByText(/secret/)).toBeNull()
    expect(queryByText('file.localPath')).toBeNull()
  })

  // DataGridDetails is lazy() behind a null Suspense fallback, so nothing at all
  // renders — not even the field name — until the chunk resolves. That chunk
  // pulls @mui/x-data-grid and core's `ui` barrel, which is slower than
  // findByText's 1s default under a loaded `jest --ci` run: this test was red on
  // main, and passes at 4s in isolation with no other change. The generous
  // timeout is the fix; shortening it makes the suite flaky rather than fast.
  test('homogeneous object array renders via the data grid', async () => {
    const { findByText } = renderWithTheme(
      <Attributes
        attributes={{
          transcripts: [
            { name: 'tx1', score: 'high' },
            { name: 'tx2', score: 'low' },
          ],
        }}
      />,
    )
    expect(await findByText('transcripts', {}, { timeout: 15000 })).toBeTruthy()
  }, 20000)
})
