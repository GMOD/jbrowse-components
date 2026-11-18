import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import GridBookmarkWidget from './GridBookmarkWidget.tsx'

import type { GridBookmarkModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          bpPerPx: 1,
          offsetPx: 0,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
          ],
        },
      ],
    },
  })
  session.addHighlight({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
    label: 'first region',
  })
  session.addHighlight({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 200,
    end: 300,
  })
  const widget = session.addWidget(
    'GridBookmarkWidget',
    'GridBookmark',
  ) as GridBookmarkModel
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GridBookmarkWidget model={widget} />
    </ThemeProvider>,
  )
  return { session, widget }
}

test('the list shows each highlight with its label', async () => {
  setup()
  expect(await screen.findByText('first region')).toBeTruthy()
  expect(screen.getByText('ctgA:1..100')).toBeTruthy()
  expect(screen.getByText('Add label...')).toBeTruthy()
})

test('a click on a label edits it, and Enter writes it to the highlight', async () => {
  const { session } = setup()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Edit label of ctgA:201..300' }),
  )
  const input = screen.getByRole('textbox', {
    name: 'Edit label of ctgA:201..300',
  })
  fireEvent.change(input, { target: { value: 'second region' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(session.highlights[1]!.label).toBe('second region')
  expect(screen.getByText('second region')).toBeTruthy()
})

test('emptying a label clears it from the highlight', async () => {
  const { session } = setup()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Edit label of ctgA:1..100' }),
  )
  const input = screen.getByRole('textbox', {
    name: 'Edit label of ctgA:1..100',
  })
  fireEvent.change(input, { target: { value: '' } })
  fireEvent.blur(input)
  expect(session.highlights[0]!.label).toBeUndefined()
})

test('the header checkbox selects every highlight for the bulk actions', async () => {
  const { widget } = setup()
  fireEvent.click(
    await screen.findByRole('checkbox', { name: 'Select ctgA:1..100' }),
  )
  expect(widget.selectedHighlights).toHaveLength(1)
  expect(screen.getByText('1 selected')).toBeTruthy()
  const all = screen.getByRole<HTMLInputElement>('checkbox', {
    name: 'Select all highlights',
  })
  expect(all.dataset.indeterminate).toBe('true')
  fireEvent.click(all)
  expect(widget.selectedHighlights).toHaveLength(2)
  fireEvent.click(all)
  expect(widget.selectedHighlights).toHaveLength(0)
})
