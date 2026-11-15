import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import { createJBrowseTheme } from '../../ui/index.ts'
import BasicValue from './BasicValue.tsx'
import Formatter from './Formatter.tsx'

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>{ui}</ThemeProvider>,
  )
}

// Formatter is what a plugin's formatter returns to have a value drawn as any
// row draws it, so it links URLs and cuts long text the same way
describe('Formatter', () => {
  test('a bare URL is a link', () => {
    const { getByRole } = renderWithTheme(
      <Formatter value="https://example.com/gene" />,
    )
    expect(getByRole('link').getAttribute('href')).toBe(
      'https://example.com/gene',
    )
  })

  test('a long URL is left whole', () => {
    const url = `https://example.com/${'a'.repeat(3000)}`
    const { getByRole, queryByText } = renderWithTheme(
      <Formatter value={url} />,
    )
    expect(getByRole('link').getAttribute('href')).toBe(url)
    expect(queryByText('Show more')).toBeNull()
  })

  test('a long value is truncated', () => {
    const { getByText } = renderWithTheme(
      <Formatter value={'ACGT'.repeat(1000)} />,
    )
    expect(getByText('Copy')).toBeTruthy()
  })

  test('a symbolic allele stays text', async () => {
    const { findByText } = renderWithTheme(<Formatter value="<DEL>" />)
    expect(await findByText('<DEL>')).toBeTruthy()
  })
})

// regression: any value starting with a URL became one link whose href was
// the whole text
test('a URL followed by more text links only the URL', async () => {
  const { findByRole } = renderWithTheme(
    <BasicValue value="https://example.com/a see also" />,
  )
  expect((await findByRole('link')).getAttribute('href')).toBe(
    'https://example.com/a',
  )
})
