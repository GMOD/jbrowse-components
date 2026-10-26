import { createJBrowseTheme } from '@jbrowse/core/ui'
import { lowerBoundOf } from '@jbrowse/core/util/fieldPredicate'
import { categoryOf } from '@jbrowse/display-kit/categoryFilter'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import {
  DEFAULT_FLAG_MASKS,
  flagMasksOf,
  mergeFilter,
  readNameOf,
  tagFiltersOf,
  withFields,
} from '../../shared/alignmentsFilter.ts'
import FilterByTagDialog from './FilterByTagDialog.tsx'

import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

afterEach(cleanup)

// The dialog over a written list, and that list as it applies after the last
// Submit wrote its fields onto it
function renderDialog(written: FieldPredicate[] = []) {
  const setFilterFields = jest.fn()
  const model = { filterPredicates: mergeFilter(written), setFilterFields }
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FilterByTagDialog model={model} handleClose={() => {}} />
    </ThemeProvider>,
  )
  return {
    submitted: () =>
      mergeFilter(withFields(written, setFilterFields.mock.lastCall![0])),
  }
}

const submit = () => {
  fireEvent.click(screen.getByText('Submit'))
}

// A literal '' matched nothing and wiped the track; an empty box is an unset
// value, which passes any read carrying the tag.
test('a tag with no value filters for reads carrying it, not for an empty value', () => {
  const { submitted } = renderDialog()
  fireEvent.change(screen.getByLabelText('Tag name'), {
    target: { value: 'HP' },
  })
  submit()
  expect(tagFiltersOf(submitted())).toEqual([{ tag: 'HP' }])
  expect(submitted()).toContainEqual({ field: 'tags.HP', valid: true })
})

test('a minimum mapping quality is stored as a number, and an empty box clears it', () => {
  const { submitted } = renderDialog([{ field: 'mapq', gte: 5 }])
  const box = screen.getByPlaceholderText('Any')
  expect((box as HTMLInputElement).value).toBe('5')
  fireEvent.change(box, { target: { value: '20' } })
  submit()
  expect(lowerBoundOf(submitted(), 'mapq')).toBe(20)
  fireEvent.change(box, { target: { value: '' } })
  submit()
  expect(lowerBoundOf(submitted(), 'mapq')).toBeUndefined()
})

test('an explicit value is stored as typed', () => {
  const { submitted } = renderDialog()
  fireEvent.change(screen.getByLabelText('Tag name'), {
    target: { value: 'HP' },
  })
  fireEvent.change(screen.getByLabelText('Tag value'), {
    target: { value: '2' },
  })
  submit()
  expect(tagFiltersOf(submitted())).toEqual([{ tag: 'HP', value: '2' }])
})

test('no tag name stores no tag filter', () => {
  const { submitted } = renderDialog()
  submit()
  expect(tagFiltersOf(submitted())).toEqual([])
})

// Two right-click quick filters (HP, then RG) are both listed, so the dialog
// never applies a filter it does not show.
test('every tag filter is listed, and one can be removed', () => {
  const { submitted } = renderDialog([
    { field: 'tags.HP', equal: '1' },
    { field: 'tags.RG', equal: 'x' },
  ])
  expect(screen.getByDisplayValue('RG')).toBeTruthy()
  expect(screen.getByDisplayValue('x')).toBeTruthy()
  fireEvent.click(screen.getAllByLabelText('Remove tag filter')[0]!)
  submit()
  expect(tagFiltersOf(submitted())).toEqual([{ tag: 'RG', value: 'x' }])
})

test('tag filters beyond the first survive a submit', () => {
  const { submitted } = renderDialog([
    { field: 'tags.HP', equal: '1' },
    { field: 'tags.RG', equal: 'x' },
  ])
  submit()
  expect(tagFiltersOf(submitted())).toEqual([
    { tag: 'HP', value: '1' },
    { tag: 'RG', value: 'x' },
  ])
})

test('an empty read name is stored as absent, not as an empty string', () => {
  const { submitted } = renderDialog([{ field: 'name', equal: 'read1' }])
  fireEvent.change(screen.getByLabelText('Read name'), {
    target: { value: '' },
  })
  submit()
  expect(readNameOf(submitted())).toBeUndefined()
  expect(submitted().some(p => p.field === 'name')).toBe(false)
})

// The mask and its checkboxes are two views of one number, so the field must
// only take values the checkboxes can represent — `Number.isFinite` accepted
// 1.5 and 1e3, and `flag & (1 << i)` then read a different number than the one
// on screen.
test('the bitmask field takes whole numbers only', () => {
  const { submitted } = renderDialog()
  const [include] = screen.getAllByDisplayValue(
    String(DEFAULT_FLAG_MASKS.include),
  )
  fireEvent.change(include!, { target: { value: '1.5' } })
  submit()
  expect(flagMasksOf(submitted())).toEqual(DEFAULT_FLAG_MASKS)
})

test('a whole-number bitmask is applied', () => {
  const { submitted } = renderDialog()
  const [include] = screen.getAllByDisplayValue(
    String(DEFAULT_FLAG_MASKS.include),
  )
  fireEvent.change(include!, { target: { value: '3' } })
  submit()
  expect(flagMasksOf(submitted()).include).toBe(3)
})

// The read categories are track-menu rows, not dialog fields (see the header
// comment there), so this dialog must leave their fields alone. It rebuilt the
// whole filter once, and Submitting a flag change silently cleared four
// filters set from the menu.
test('a submit preserves the read categories it does not show', () => {
  const { submitted } = renderDialog([
    { field: 'svSignal', equal: true },
    { field: 'split', equal: true },
  ])
  fireEvent.change(screen.getByLabelText('Read name'), {
    target: { value: 'readA' },
  })
  submit()
  const list = submitted()
  expect(readNameOf(list)).toBe('readA')
  expect(categoryOf(list, 'svSignal')).toBe('only')
  expect(categoryOf(list, 'split')).toBe('only')
})

// Reset undoes this dialog, not every filter on the track — the same rule the
// read right-click's "Clear read/tag filters" follows. "Clear all filters" in
// the track menu is the one that resets the whole filter.
test('resetting leaves the read categories alone', () => {
  const { submitted } = renderDialog([
    { field: 'name', equal: 'readA' },
    { field: 'spliced', equal: true },
    { field: 'svSignal', equal: true },
  ])
  fireEvent.click(screen.getByText('Reset defaults'))
  submit()
  const list = submitted()
  expect(readNameOf(list)).toBeUndefined()
  expect(categoryOf(list, 'spliced')).toBe('only')
  expect(categoryOf(list, 'svSignal')).toBe('only')
})

test('no read-category control is offered here', () => {
  renderDialog([{ field: 'split', equal: true }])
  expect(screen.queryByText('Read categories')).toBeNull()
  expect(screen.queryByLabelText('Split reads: Only')).toBeNull()
})

// One row per flag with a Require and an Exclude box, so the same flag can be
// required and excluded — a track that renders empty — and now says so on one
// line rather than across two twelve-checkbox columns.
test('the flag grid drives both masks off one row per flag', () => {
  const { submitted } = renderDialog()
  fireEvent.click(screen.getByLabelText('Require read paired'))
  fireEvent.click(screen.getByLabelText('Exclude not primary alignment'))
  submit()
  expect(flagMasksOf(submitted())).toEqual({
    include: DEFAULT_FLAG_MASKS.include | 0x1,
    exclude: DEFAULT_FLAG_MASKS.exclude | 0x100,
  })
})

test('unticking a default exclusion writes the field that removes it', () => {
  const { submitted } = renderDialog()
  fireEvent.click(
    screen.getByLabelText('Exclude read is PCR or optical duplicate'),
  )
  submit()
  expect(flagMasksOf(submitted()).exclude).toBe(
    DEFAULT_FLAG_MASKS.exclude & ~0x400,
  )
})

// The layers' own filters sit in the dialog while the layer draws
test('the Sashimi arcs section shows while the arcs draw, and writes its floor', () => {
  const setFilterFields = jest.fn()
  const model = {
    filterPredicates: mergeFilter([]),
    setFilterFields,
    showSashimi: true,
    junctionFilter: { minReads: 1 },
  }
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FilterByTagDialog model={model} handleClose={() => {}} />
    </ThemeProvider>,
  )
  expect(screen.getByText('Sashimi arcs')).toBeTruthy()
  expect(screen.queryByText('Read connections')).toBeNull()
  fireEvent.change(screen.getByLabelText('Min reads at a junction'), {
    target: { value: '5' },
  })
  submit()
  expect(setFilterFields.mock.lastCall![0]['junction.reads']).toEqual([
    { field: 'junction.reads', gte: 5 },
  ])
})
