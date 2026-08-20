import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MAX_GROUPS } from '../../shared/groupFeatures.ts'
import GroupByDialog from './GroupByDialog.tsx'
import { tagGroupingVerdict } from './tagGroupingVerdict.ts'

import type { ColorBy, GroupBy } from '../../shared/types.ts'
import type { GroupByDialogModel } from './GroupByDialog.tsx'

afterEach(cleanup)

// Only the tag/color surface is exercised here: the distinct-value lookup is
// debounced a second behind the box, so an unadvanced test never issues it and
// needs no view or RPC.
function renderDialog(state: { colorBy: ColorBy; groupBy?: GroupBy }) {
  const setGroupBy = jest.fn()
  const setColorScheme = jest.fn()
  const model = {
    id: 'display1',
    colorBy: state.colorBy,
    groupBy: state.groupBy,
    filterBy: {},
    setGroupBy,
    setColorScheme,
  } as unknown as GroupByDialogModel
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupByDialog model={model} handleClose={() => {}} />
    </ThemeProvider>,
  )
  return { setGroupBy, setColorScheme }
}

const checkbox = () => screen.getByRole('checkbox') as HTMLInputElement

function typeTag(tag: string) {
  fireEvent.change(screen.getByTestId('group-tag-name-input'), {
    target: { value: tag },
  })
}

function submit() {
  fireEvent.click(screen.getByText('Submit'))
}

// The box is a default until it is clicked, and the tag it defaults against is
// the one in the box — not the one the model held when the dialog opened. Reads
// already colored by HP, grouped by nothing: the box used to open unticked
// (there was no groupBy to compare against), and unticked means "don't color by
// this tag", so submitting reset the HP coloring the user could see.
test('typing the tag the reads are already colored by keeps that coloring', () => {
  const { setGroupBy, setColorScheme } = renderDialog({
    colorBy: { type: 'tag', tag: 'HP' },
  })
  expect(checkbox().checked).toBe(false)
  typeTag('HP')
  expect(checkbox().checked).toBe(true)
  submit()
  expect(setGroupBy).toHaveBeenCalledWith({ type: 'tag', tag: 'HP' })
  expect(setColorScheme).toHaveBeenCalledWith({ type: 'tag', tag: 'HP' })
})

// A different tag's colors are in force, so the box stays a genuine offer to
// replace them and does nothing unless taken.
test('a different tag colouring leaves the box unticked and untouched', () => {
  const { setColorScheme } = renderDialog({
    colorBy: { type: 'tag', tag: 'RG' },
  })
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  submit()
  expect(setColorScheme).not.toHaveBeenCalled()
})

// Grouping by a tag usually pairs with coloring by it, so an uncolored track
// opts in by default.
test('an uncolored track defaults to coloring by the grouped tag', () => {
  const { setColorScheme } = renderDialog({ colorBy: { type: 'normal' } })
  typeTag('HP')
  expect(checkbox().checked).toBe(true)
  submit()
  expect(setColorScheme).toHaveBeenCalledWith({ type: 'tag', tag: 'HP' })
})

// Unticking is still how you drop the coloring this dialog would set, and it
// pins: the default no longer re-ticks the box as the tag is edited.
test('unticking drops the matching coloring and stays unticked', () => {
  const { setColorScheme } = renderDialog({
    colorBy: { type: 'tag', tag: 'HP' },
    groupBy: { type: 'tag', tag: 'HP' },
  })
  expect(checkbox().checked).toBe(true)
  fireEvent.click(checkbox())
  expect(checkbox().checked).toBe(false)
  typeTag('HP')
  expect(checkbox().checked).toBe(false)
  submit()
  expect(setColorScheme).toHaveBeenCalledWith({ type: 'normal' })
})

// The scan's verdict, unit-tested rather than driven through the dialog: the
// lookup is debounced a second behind the box and goes out over an RPC, so
// reaching these states through the component would need a view and a worker to
// assert on three strings.
describe('tagGroupingVerdict', () => {
  // Nothing describes the tag in the box yet — the dialog is showing the scan's
  // error or its progress line, and this must not claim an answer over either.
  test('says nothing before a scan lands', () => {
    expect(tagGroupingVerdict('HP', undefined)).toBeUndefined()
  })

  // The end this dialog was built for: `tag` is the one dimension whose
  // cardinality the DATA decides. `>=` because reads LACKING the tag take a
  // section besides — see the function.
  test('refuses a tag that would flood the track with sections', () => {
    const many = Array.from({ length: MAX_GROUPS }, (_, i) => `${i}`)
    const verdict = tagGroupingVerdict('RX', many)
    expect(verdict?.blocks).toBe(true)
    expect(verdict?.text).toContain(`${MAX_GROUPS} distinct values`)

    expect(tagGroupingVerdict('RX', many.slice(0, -1))?.blocks).toBe(false)
  })

  // The other end, which used to fall through to no caption at all: every read
  // files under the '' sentinel, so the grouping draws one section named for a
  // tag nothing carries. Warned about rather than refused — the scan only sees
  // the blocks in view.
  test('warns when no read carries the tag, without refusing', () => {
    const verdict = tagGroupingVerdict('HP', [])
    expect(verdict?.blocks).toBe(false)
    expect(verdict?.color).toBe('warning.main')
    expect(verdict?.text).toContain('No read in view carries HP')
  })

  // Listed in the order the sections will stack, not the order the reads arrived.
  test('lists the found values in stacking order', () => {
    expect(tagGroupingVerdict('HP', ['10', '2', '1'])?.text).toBe(
      'Found values: 1, 2, 10',
    )
  })
})
