import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import { createJBrowseTheme } from '../../ui/index.ts'
import Attributes from './Attributes.tsx'

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>{ui}</ThemeProvider>,
  )
}

// every rendered label, with the inline width Attributes gave its column
function labelWidths(container: HTMLElement) {
  return Object.fromEntries(
    [...container.querySelectorAll<HTMLElement>('div[style*="width"]')].map(
      el => [el.textContent, el.style.width],
    ),
  )
}

describe('Attributes', () => {
  // regression: the column was measured per nesting level, so `a` sat in one
  // width, `nested.b` in another and the URI row — which was handed no width at
  // all — sized itself to content. Three ragged steps down one card.
  test('every label in a card shares one column width', () => {
    const { container } = renderWithTheme(
      <Attributes
        attributes={{
          a: 'x',
          // a flat array is a labelled row like any other, so it is in the
          // column too — `assemblyNames` and `category` on a track config
          list: ['one', 'two'],
          nested: {
            aLongerFieldName: 'y',
            file: { uri: 'https://example.com/x' },
          },
        }}
      />,
    )
    const widths = labelWidths(container)
    expect(Object.keys(widths).sort()).toEqual([
      'a',
      'list',
      'nested.aLongerFieldName',
      'nested.file',
    ])
    expect(new Set(Object.values(widths)).size).toBe(1)
  })

  // an array of objects renders each element as its own Attributes block with
  // no label row at this level, so measuring its key would widen the column for
  // a label that is never drawn
  test('an object array contributes no label to the column', () => {
    const width = (attributes: Record<string, unknown>) =>
      Object.values(
        labelWidths(
          renderWithTheme(<Attributes {...{ attributes }} />).container,
        ),
      )[0]
    expect(width({ a: 'x', aVeryMuchLongerName: [{ b: 'y' }] })).toBe(
      width({ a: 'x' }),
    )
  })

  // the padding around a label is added once, not once per level: a recursive
  // measurement that returned its own padded result compounded it with depth
  test('nesting depth does not pad the column', () => {
    const width = (attributes: Record<string, unknown>) =>
      Object.values(
        labelWidths(
          renderWithTheme(<Attributes {...{ attributes }} />).container,
        ),
      )[0]
    expect(width({ 'a.b.c': 'x' })).toBe(width({ a: { b: { c: 'x' } } }))
  })

  // the walk that measures has to make the same branch decisions the render
  // does; measuring a label that hideUris removes would widen the column for a
  // row nobody sees
  test('the column ignores labels hideUris removes', () => {
    const attributes = {
      a: 'x',
      aVeryMuchLongerFieldName: { uri: 'https://example.com/x' },
    }
    const shown = labelWidths(
      renderWithTheme(<Attributes {...{ attributes }} />).container,
    )
    const hidden = labelWidths(
      renderWithTheme(<Attributes attributes={attributes} hideUris />)
        .container,
    )
    expect(hidden.a).not.toBe(shown.a)
  })

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
