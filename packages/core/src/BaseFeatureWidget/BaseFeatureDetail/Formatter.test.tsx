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

// The alignments, variant and synteny panels pass every value through
// Formatter, which printed plain text: a formatDetails callback's link, or an
// INFO field's URL, was dead text there and a link everywhere else
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
    const url = `https://example.com/${'a'.repeat(150)}`
    const { getByRole, queryByText } = renderWithTheme(
      <Formatter value={url} />,
    )
    expect(getByRole('link').getAttribute('href')).toBe(url)
    expect(queryByText('Show more')).toBeNull()
  })

  test('a long value is truncated', () => {
    const { getByText } = renderWithTheme(
      <Formatter value={'ACGT'.repeat(50)} />,
    )
    expect(getByText('Show more')).toBeTruthy()
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
