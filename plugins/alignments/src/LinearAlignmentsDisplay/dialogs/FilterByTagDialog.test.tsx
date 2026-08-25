import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { defaultFilterFlags, filterTagValue } from '../../shared/util.ts'
import FilterByTagDialog from './FilterByTagDialog.tsx'

import type { FilterBy } from '../../shared/types.ts'

afterEach(cleanup)

function renderDialog(filterBy: Partial<FilterBy> = {}) {
  const setFilterBy = jest.fn()
  const model = {
    filterBy: { ...defaultFilterFlags, ...filterBy },
    setFilterBy,
  }
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FilterByTagDialog model={model} handleClose={() => {}} />
    </ThemeProvider>,
  )
  return { setFilterBy }
}

const submit = () => {
  fireEvent.click(screen.getByText('Submit'))
}

// The value box is optional in the UI but not in the filter: `filterTagValue`
// compares the read's value against whatever is stored, so a literal '' matched
// nothing and wiped the track. '*' is the "has this tag" spelling the box's own
// placeholder offers.
test('a tag with no value filters for reads carrying it, not for an empty value', () => {
  const { setFilterBy } = renderDialog()
  fireEvent.change(screen.getByLabelText('Tag name'), {
    target: { value: 'HP' },
  })
  submit()
  expect(setFilterBy).toHaveBeenCalledWith(
    expect.objectContaining({ tagFilters: [{ tag: 'HP', value: '*' }] }),
  )
  // and that is the value that keeps a tagged read rather than dropping it
  expect(filterTagValue('1', '*')).toBe(false)
  expect(filterTagValue('1', '')).toBe(true)
})

test('an explicit value is stored as typed', () => {
  const { setFilterBy } = renderDialog()
  fireEvent.change(screen.getByLabelText('Tag name'), {
    target: { value: 'HP' },
  })
  fireEvent.change(screen.getByLabelText('Tag value'), {
    target: { value: '2' },
  })
  submit()
  expect(setFilterBy).toHaveBeenCalledWith(
    expect.objectContaining({ tagFilters: [{ tag: 'HP', value: '2' }] }),
  )
})

test('no tag name stores no tag filter', () => {
  const { setFilterBy } = renderDialog()
  submit()
  expect(setFilterBy).toHaveBeenCalledWith(
    expect.objectContaining({ tagFilters: undefined }),
  )
})

// Quick filters set from the read right-click menu aren't editable here, but
// submitting after tweaking a flag must not drop them.
test('tag filters beyond the first survive a submit', () => {
  const { setFilterBy } = renderDialog({
    tagFilters: [
      { tag: 'HP', value: '1' },
      { tag: 'RG', value: 'x' },
    ],
  })
  submit()
  expect(setFilterBy).toHaveBeenCalledWith(
    expect.objectContaining({
      tagFilters: [
        { tag: 'HP', value: '1' },
        { tag: 'RG', value: 'x' },
      ],
    }),
  )
})

test('an empty read name is stored as absent, not as an empty string', () => {
  const { setFilterBy } = renderDialog({ readName: 'read1' })
  fireEvent.change(screen.getByPlaceholderText('Enter read name'), {
    target: { value: '' },
  })
  submit()
  expect(setFilterBy).toHaveBeenCalledWith(
    expect.objectContaining({ readName: undefined }),
  )
})

// The mask and its checkboxes are two views of one number, so the field must
// only take values the checkboxes can represent — `Number.isFinite` accepted
// 1.5 and 1e3, and `flag & (1 << i)` then read a different number than the one
// on screen.
test('the bitmask field takes whole numbers only', () => {
  const { setFilterBy } = renderDialog()
  const [include] = screen.getAllByDisplayValue(
    String(defaultFilterFlags.flagInclude),
  )
  fireEvent.change(include!, { target: { value: '1.5' } })
  submit()
  expect(setFilterBy).toHaveBeenCalledWith(
    expect.objectContaining({ flagInclude: defaultFilterFlags.flagInclude }),
  )
})

test('a whole-number bitmask is applied', () => {
  const { setFilterBy } = renderDialog()
  const [include] = screen.getAllByDisplayValue(
    String(defaultFilterFlags.flagInclude),
  )
  fireEvent.change(include!, { target: { value: '3' } })
  submit()
  expect(setFilterBy).toHaveBeenCalledWith(
    expect.objectContaining({ flagInclude: 3 }),
  )
})

test('the splicing radios store only/exclude and drop the filter for "all"', () => {
  const { setFilterBy } = renderDialog()
  fireEvent.click(screen.getByLabelText('Only spliced reads'))
  submit()
  expect(setFilterBy).toHaveBeenCalledWith(
    expect.objectContaining({ spliced: 'only' }),
  )
})

test('resetting clears a stored splicing filter', () => {
  const { setFilterBy } = renderDialog({ spliced: 'exclude' })
  expect(
    screen.getByLabelText<HTMLInputElement>('Only unspliced reads').checked,
  ).toBe(true)
  fireEvent.click(screen.getByText('Reset defaults'))
  submit()
  expect(setFilterBy).toHaveBeenCalledWith(
    expect.objectContaining({ spliced: undefined }),
  )
})
