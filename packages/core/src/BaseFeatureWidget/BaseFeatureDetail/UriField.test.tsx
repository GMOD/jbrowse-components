import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import { createJBrowseTheme } from '../../ui/index.ts'
import UriField from './UriField.tsx'

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>{ui}</ThemeProvider>,
  )
}

describe('UriField', () => {
  test('resolves a relative uri against baseUri', () => {
    const { getByRole } = renderWithTheme(
      <UriField
        name="link"
        prefix={[]}
        value={{ uri: 'sub/page.html', baseUri: 'https://example.com/a/' }}
      />,
    )
    expect(getByRole('link').getAttribute('href')).toBe(
      'https://example.com/a/sub/page.html',
    )
  })

  test('renders an absolute uri as a link', () => {
    const { getByRole } = renderWithTheme(
      <UriField
        name="link"
        prefix={[]}
        value={{ uri: 'https://example.com/x' }}
      />,
    )
    expect(getByRole('link').getAttribute('href')).toBe('https://example.com/x')
  })

  test('falls back to the raw uri when URL construction fails', () => {
    const { getByText } = renderWithTheme(
      <UriField name="link" prefix={[]} value={{ uri: 'not a url' }} />,
    )
    expect(getByText('not a url')).toBeTruthy()
  })
})
