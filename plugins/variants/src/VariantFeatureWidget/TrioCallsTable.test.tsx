import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render, screen, within } from '@testing-library/react'

import { trioCalls } from '../shared/trios.ts'
import TrioCallsTable from './TrioCallsTable.tsx'

test('a trio’s row shows the genotypes its check read', () => {
  const genotypes = new Map([
    ['kid', '1/1'],
    ['dad', '0/0'],
    ['mom', '0/1'],
  ])
  const calls = trioCalls(
    [
      { child: 'kid', father: 'dad', mother: 'mom', sex: 'male' },
      { child: 'orphan', father: 'absent' },
    ],
    sample => genotypes.get(sample),
    [],
  )
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <TrioCallsTable trioCalls={calls} />
    </ThemeProvider>,
  )
  const cellsOf = (name: string) =>
    within(screen.getByRole('row', { name: new RegExp(`^${name} `) }))
      .getAllByRole('cell')
      .map(cell => cell.textContent)

  expect(
    screen.getAllByRole('columnheader').map(cell => cell.textContent),
  ).toEqual(expect.arrayContaining(['child GT', 'father GT', 'mother GT']))
  expect(cellsOf('kid')).toEqual([
    'kid',
    '1/1',
    'dad',
    '0/0',
    'mom',
    '0/1',
    'male',
    'Mendelian violation',
  ])
  expect(cellsOf('orphan')).toEqual([
    'orphan',
    '',
    'absent',
    '.',
    '',
    '',
    '',
    '',
  ])
})
