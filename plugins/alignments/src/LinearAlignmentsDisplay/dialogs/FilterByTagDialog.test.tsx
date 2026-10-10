import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { defaultFilterFlags, filterTagValue } from '../../shared/util.ts'
import FilterByTagDialog from './FilterByTagDialog.tsx'

import type { ReadFilter } from '../../shared/types.ts'

afterEach(cleanup)

function renderDialog(filterBy: Partial<ReadFilter> = {}) {
  const setReadFilter = jest.fn()
  const model = {
    readFilter: { ...defaultFilterFlags, ...filterBy },
    setReadFilter,
  }
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FilterByTagDialog model={model} handleClose={() => {}} />
    </ThemeProvider>,
  )
  return { setReadFilter }
}

const submit = () => {
  fireEvent.click(screen.getByText('Submit'))
}

// The value box is optional in the UI but not in the filter: `filterTagValue`
// compares the read's value against whatever is stored, so a literal '' matched
// nothing and wiped the track. '*' is the "has this tag" spelling the box's
// helper text offers.
test('a tag with no value filters for reads carrying it, not for an empty value', () => {
  const { setReadFilter } = renderDialog()
  fireEvent.change(screen.getByLabelText('Tag name'), {
    target: { value: 'HP' },
  })
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({ tagFilters: [{ tag: 'HP', value: '*' }] }),
  )
  // and that is the value that keeps a tagged read rather than dropping it
  expect(filterTagValue('1', '*')).toBe(false)
  expect(filterTagValue('1', '')).toBe(true)
})

test('an explicit value is stored as typed', () => {
  const { setReadFilter } = renderDialog()
  fireEvent.change(screen.getByLabelText('Tag name'), {
    target: { value: 'HP' },
  })
  fireEvent.change(screen.getByLabelText('Tag value'), {
    target: { value: '2' },
  })
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({ tagFilters: [{ tag: 'HP', value: '2' }] }),
  )
})

test('no tag name stores no tag filter', () => {
  const { setReadFilter } = renderDialog()
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({ tagFilters: undefined }),
  )
})

// Two right-click quick filters (HP, then RG) are both listed, so the dialog
// never applies a filter it does not show.
test('every tag filter is listed, and one can be removed', () => {
  const { setReadFilter } = renderDialog({
    tagFilters: [
      { tag: 'HP', value: '1' },
      { tag: 'RG', value: 'x' },
    ],
  })
  expect(screen.getByDisplayValue('RG')).toBeTruthy()
  expect(screen.getByDisplayValue('x')).toBeTruthy()
  fireEvent.click(screen.getAllByLabelText('Remove tag filter')[0]!)
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({ tagFilters: [{ tag: 'RG', value: 'x' }] }),
  )
})

test('tag filters beyond the first survive a submit', () => {
  const { setReadFilter } = renderDialog({
    tagFilters: [
      { tag: 'HP', value: '1' },
      { tag: 'RG', value: 'x' },
    ],
  })
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({
      tagFilters: [
        { tag: 'HP', value: '1' },
        { tag: 'RG', value: 'x' },
      ],
    }),
  )
})

test('an empty read name is stored as absent, not as an empty string', () => {
  const { setReadFilter } = renderDialog({ readName: 'read1' })
  fireEvent.change(screen.getByPlaceholderText('Enter read name'), {
    target: { value: '' },
  })
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({ readName: undefined }),
  )
})

// The mask and its checkboxes are two views of one number, so the field must
// only take values the checkboxes can represent — `Number.isFinite` accepted
// 1.5 and 1e3, and `flag & (1 << i)` then read a different number than the one
// on screen.
test('the bitmask field takes whole numbers only', () => {
  const { setReadFilter } = renderDialog()
  const [include] = screen.getAllByDisplayValue(
    String(defaultFilterFlags.flagInclude),
  )
  fireEvent.change(include!, { target: { value: '1.5' } })
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({ flagInclude: defaultFilterFlags.flagInclude }),
  )
})

test('a whole-number bitmask is applied', () => {
  const { setReadFilter } = renderDialog()
  const [include] = screen.getAllByDisplayValue(
    String(defaultFilterFlags.flagInclude),
  )
  fireEvent.change(include!, { target: { value: '3' } })
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({ flagInclude: 3 }),
  )
})

// The read categories are track-menu rows, not dialog fields (see the header
// comment there), so this dialog must carry them through untouched rather than
// rebuild filterBy from what it shows. It rebuilt it once, and Submitting a
// flag change silently cleared four filters set from the menu.
test('a submit preserves the read categories it does not show', () => {
  const { setReadFilter } = renderDialog({
    properPairs: 'exclude',
    split: 'only',
  })
  fireEvent.change(screen.getByPlaceholderText('Enter read name'), {
    target: { value: 'readA' },
  })
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({
      readName: 'readA',
      properPairs: 'exclude',
      split: 'only',
    }),
  )
})

// Reset undoes this dialog, not every filter on the track — the same rule the
// read right-click's "Clear read/tag filters" follows. "Clear all filters" in
// the track menu is the one that resets the whole of filterBy.
test('resetting leaves the read categories alone', () => {
  const { setReadFilter } = renderDialog({
    readName: 'readA',
    spliced: 'only',
    properPairs: 'exclude',
  })
  fireEvent.click(screen.getByText('Reset defaults'))
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({
      readName: undefined,
      spliced: 'only',
      properPairs: 'exclude',
    }),
  )
})

test('no read-category control is offered here', () => {
  renderDialog({ split: 'only' })
  expect(screen.queryByText('Read categories')).toBeNull()
  expect(screen.queryByLabelText('Split alignments: Only')).toBeNull()
})

// One row per flag with a Require and an Exclude box, so the same flag can be
// required and excluded — a track that renders empty — and now says so on one
// line rather than across two twelve-checkbox columns.
test('the flag grid drives both masks off one row per flag', () => {
  const { setReadFilter } = renderDialog()
  fireEvent.click(screen.getByLabelText('Require read paired'))
  fireEvent.click(screen.getByLabelText('Exclude not primary alignment'))
  submit()
  expect(setReadFilter).toHaveBeenCalledWith(
    expect.objectContaining({
      flagInclude: defaultFilterFlags.flagInclude | 0x1,
      flagExclude: defaultFilterFlags.flagExclude | 0x100,
    }),
  )
})
