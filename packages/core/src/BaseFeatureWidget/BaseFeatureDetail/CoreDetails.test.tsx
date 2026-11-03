import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { createJBrowseTheme } from '../../ui/index.ts'
import CoreDetails from './CoreDetails.tsx'
import { valueAt } from './util.ts'

test('offers actions on the name and type rows, by the field they read', () => {
  const fieldActions = jest.fn(() => [])
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CoreDetails
        feature={{
          uniqueId: 'f',
          refName: 'ctgA',
          start: 0,
          end: 100,
          name: 'EDEN',
          description: 'a gene',
          type: 'gene',
        }}
        fieldActions={fieldActions}
      />
    </ThemeProvider>,
  )
  expect(fieldActions.mock.calls).toEqual([
    [['name'], 'EDEN'],
    [['type'], 'gene'],
  ])
})

test('the position moves the view onto the feature when the view can', () => {
  const go = jest.fn()
  const feature = { uniqueId: 'f', refName: 'ctgA', start: 0, end: 100 }
  const { getByTitle } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <CoreDetails
        feature={feature}
        locate={f => (f === feature ? go : undefined)}
      />
    </ThemeProvider>,
  )
  fireEvent.click(getByTitle('Show in view'))
  expect(go).toHaveBeenCalled()
})

test('valueAt reads a nested path and unwraps a one-element array', () => {
  const feature = { Dbxref: ['GeneID:1'], aliases: ['a', 'b'], nest: { a: 2 } }
  expect(valueAt(['Dbxref'], feature)).toBe('GeneID:1')
  expect(valueAt(['aliases'], feature)).toEqual(['a', 'b'])
  expect(valueAt(['nest', 'a'], feature)).toBe(2)
  expect(valueAt(['nest', 'missing', 'x'], feature)).toBeUndefined()
})
