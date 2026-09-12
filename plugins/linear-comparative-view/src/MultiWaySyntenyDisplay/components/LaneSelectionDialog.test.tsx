import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import LaneSelectionDialog, { laneRuns } from './LaneSelectionDialog.tsx'

import type { LaneChoice } from '../menus.ts'

const universe: LaneChoice[] = [
  { name: 'HG1.1', label: 'HG1#1', group: 'HG1', placed: true },
  { name: 'HG1#2', label: 'HG1#2', group: 'HG1', placed: false },
  { name: 'HG2#1', label: 'HG2#1', group: 'HG2', placed: true },
  { name: 'extra', placed: true },
]

function renderDialog(selection?: string[], hidden: string[] = []) {
  const calls: (string[] | undefined)[] = []
  const hides: string[][] = []
  const closes: number[] = []
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaneSelectionDialog
        model={{
          laneUniverse: universe,
          laneSelection: selection,
          setSelectedLanes: names => {
            calls.push(names)
          },
          hiddenLanes: hidden,
          setHiddenLanes: names => {
            hides.push(names)
          },
        }}
        handleClose={() => {
          closes.push(1)
        }}
      />
    </ThemeProvider>,
  )
  return { calls, hides, closes }
}

test('lanes run under their group, and a lane without one heads no run', () => {
  expect(
    laneRuns(universe).map(run => [run.group, run.lanes.map(l => l.name)]),
  ).toEqual([
    ['HG1', ['HG1.1', 'HG1#2']],
    ['HG2', ['HG2#1']],
    [undefined, ['extra']],
  ])
})

test('opens on every lane when nothing is chosen, and writes back the ticked set', () => {
  const { calls, closes } = renderDialog()
  expect(screen.getByText('4 of 4 lanes chosen', { exact: false })).toBeTruthy()
  // the assembly name first, the source's own label beside it
  const hg1 = screen.getByLabelText('HG1.1 (HG1#1)')
  expect(hg1).toBeChecked()
  fireEvent.click(hg1)
  fireEvent.click(screen.getByLabelText('extra'))
  fireEvent.click(screen.getByText('Draw these lanes'))
  expect(calls).toEqual([['HG1#2', 'HG2#1']])
  expect(closes).toHaveLength(1)
})

test('ticking every lane writes no selection, and Every lane drops one', () => {
  const { calls } = renderDialog(['HG2#1'])
  expect(screen.getByLabelText('HG2#1')).toBeChecked()
  expect(screen.getByLabelText('extra')).not.toBeChecked()
  fireEvent.click(screen.getByText('Tick shown'))
  fireEvent.click(screen.getByText('Draw these lanes'))
  expect(calls).toEqual([undefined])
  fireEvent.click(screen.getByText('Every lane'))
  expect(calls).toEqual([undefined, undefined])
})

test('a hidden lane opens unticked, and ticking it unhides it', () => {
  const { hides } = renderDialog(undefined, ['extra'])
  expect(screen.getByLabelText('extra')).not.toBeChecked()
  fireEvent.click(screen.getByLabelText('extra'))
  fireEvent.click(screen.getByText('Draw these lanes'))
  expect(hides).toEqual([[]])
})

test('a chosen lane this window does not place survives a submit', () => {
  const { calls } = renderDialog(['HG2#1', 'far-away'])
  fireEvent.click(screen.getByLabelText('extra'))
  fireEvent.click(screen.getByText('Draw these lanes'))
  expect(calls).toEqual([['HG2#1', 'extra', 'far-away']])
})

test('the filter narrows what the bulk buttons touch', () => {
  const { calls } = renderDialog()
  fireEvent.change(screen.getByPlaceholderText('Filter lanes'), {
    target: { value: 'hg1' },
  })
  expect(screen.queryByLabelText('extra')).toBeNull()
  fireEvent.click(screen.getByText('Untick shown'))
  fireEvent.click(screen.getByText('Draw these lanes'))
  expect(calls).toEqual([['HG2#1', 'extra']])
})
