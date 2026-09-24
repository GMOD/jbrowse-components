import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import LaneSelectionDialog, {
  laneCaption,
  laneRuns,
} from './LaneSelectionDialog.tsx'

import type { LaneChoice } from '../laneSelection.ts'

const universe: LaneChoice[] = [
  { name: 'HG1.1', label: 'HG1#1', group: 'HG1', placed: true, drawn: true },
  { name: 'HG1#2', label: 'HG1#2', group: 'HG1', placed: false, drawn: true },
  { name: 'HG2#1', label: 'HG2#1', group: 'HG2', placed: true, drawn: true },
  { name: 'extra', placed: true, drawn: true },
]

function renderDialog(drawn?: string[], configuredLanes: string[] = []) {
  const chosen: string[][] = []
  const resets: number[] = []
  const closes: number[] = []
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaneSelectionDialog
        model={{
          laneUniverse: universe.map(lane => ({
            ...lane,
            drawn: drawn?.includes(lane.name) ?? true,
          })),
          laneFilter: drawn && { only: drawn },
          configuredLanes,
          chooseLanes: names => {
            chosen.push(names)
          },
          setSelectedLanes: () => {
            resets.push(1)
          },
        }}
        handleClose={() => {
          closes.push(1)
        }}
      />
    </ThemeProvider>,
  )
  return { chosen, resets, closes }
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

test('opens on the lanes the stack draws, and hands over the ticked set', () => {
  const { chosen, closes } = renderDialog()
  expect(screen.getByText('4 of 4 lanes chosen', { exact: false })).toBeTruthy()
  // the assembly name first, the source's own label beside it
  const hg1 = screen.getByLabelText('HG1.1 (HG1#1)')
  expect(hg1).toBeChecked()
  fireEvent.click(hg1)
  fireEvent.click(screen.getByLabelText('extra'))
  fireEvent.click(screen.getByText('Draw these lanes'))
  expect(chosen).toEqual([['HG1#2', 'HG2#1']])
  expect(closes).toHaveLength(1)
})

// An unchanged submit handed over would turn hidden lanes into a list that
// shuts out every lane placed later
test('an unchanged submit hands over nothing, and Reset says where it goes', () => {
  const { chosen, resets } = renderDialog(['HG2#1'], ['HG2#1'])
  expect(screen.getByLabelText('HG2#1')).toBeChecked()
  expect(screen.getByLabelText('extra')).not.toBeChecked()
  fireEvent.click(screen.getByText('Draw these lanes'))
  expect(chosen).toEqual([])
  fireEvent.click(screen.getByText("Show the track's lanes (1)"))
  expect(resets).toHaveLength(1)
})

test('the filter narrows what the bulk buttons touch', () => {
  const { chosen } = renderDialog()
  fireEvent.change(screen.getByPlaceholderText('Filter lanes'), {
    target: { value: 'hg1' },
  })
  expect(screen.queryByLabelText('extra')).toBeNull()
  fireEvent.click(screen.getByText('Untick shown'))
  fireEvent.click(screen.getByText('Draw these lanes'))
  expect(chosen).toEqual([['HG2#1', 'extra']])
})

test('a lane the fetch never asked for is not greyed as placing nothing', () => {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaneSelectionDialog
        model={{
          laneUniverse: [
            { name: 'asked', placed: true, drawn: true },
            { name: 'unasked', placed: undefined, drawn: false },
          ],
          laneFilter: { only: ['asked'] },
          configuredLanes: [],
          chooseLanes: () => {},
          setSelectedLanes: () => {},
        }}
        handleClose={() => {}}
      />
    </ThemeProvider>,
  )
  expect(screen.queryByText(/in grey/)).toBeNull()
})

test('a caption names the lane once when its label already does', () => {
  const lane = { placed: true, drawn: true }
  expect(laneCaption({ ...lane, name: 'panTro6' })).toBe('panTro6')
  expect(
    laneCaption({ ...lane, name: 'panTro6', label: 'Chimp (panTro6)' }),
  ).toBe('Chimp (panTro6)')
  expect(laneCaption({ ...lane, name: 'HG1.1', label: 'HG1#1' })).toBe(
    'HG1.1 (HG1#1)',
  )
})
