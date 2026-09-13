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

function renderDialog(selection?: string[], configuredLanes: string[] = []) {
  const calls: (string[] | undefined)[] = []
  const closes: number[] = []
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaneSelectionDialog
        model={{
          laneUniverse: universe,
          laneSelection:
            selection ?? (configuredLanes.length ? configuredLanes : undefined),
          selectedLanes: selection,
          configuredLanes,
          setSelectedLanes: names => {
            calls.push(names)
          },
        }}
        handleClose={() => {
          closes.push(1)
        }}
      />
    </ThemeProvider>,
  )
  return { calls, closes }
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

test('ticking every lane writes no selection, and Reset drops one', () => {
  const { calls } = renderDialog(['HG2#1'])
  expect(screen.getByLabelText('HG2#1')).toBeChecked()
  expect(screen.getByLabelText('extra')).not.toBeChecked()
  fireEvent.click(screen.getByText('Tick shown'))
  fireEvent.click(screen.getByText('Draw these lanes'))
  expect(calls).toEqual([undefined])
  fireEvent.click(screen.getByText('Every lane (4)'))
  expect(calls).toEqual([undefined, undefined])
})

// No selection over a config naming its own lanes means those lanes, so an
// all-ticked submit that wrote none drew the config's eight out of 464
test('over a config naming lanes, every lane ticked is written out, and Reset goes back to the config', () => {
  const { calls } = renderDialog(undefined, ['HG2#1'])
  expect(screen.getByText('1 of 4 lanes chosen', { exact: false })).toBeTruthy()
  fireEvent.click(screen.getByText('Tick shown'))
  fireEvent.click(screen.getByText('Draw these lanes'))
  expect(calls).toEqual([['HG1.1', 'HG1#2', 'HG2#1', 'extra']])
  fireEvent.click(screen.getByText("The track's lanes (1)"))
  expect(calls.at(-1)).toBeUndefined()
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
