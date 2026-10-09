import { act, fireEvent, render, screen } from '@testing-library/react'
import { observable } from 'mobx'

import { SearchPicker } from './searchPicker.tsx'

import type { SearchPickerView } from './searchPicker.tsx'

function fakeView(pick = jest.fn(() => Promise.resolve())) {
  const view = observable({
    searchPicker: undefined as SearchPickerView['searchPicker'],
    closeSearchPicker() {
      view.searchPicker = undefined
    },
  })
  return {
    view,
    pick,
    raise() {
      act(() => {
        view.searchPicker = {
          query: 'BRC',
          pick,
          rows: [
            {
              id: 'a',
              label: 'BRCA1',
              location: 'chr17:43,044,295..43,125,364',
              trackName: 'RefSeq',
            },
            {
              id: 'b',
              label: 'BRCA1P1',
              location: 'chr17:43,000..44,000',
              trackName: '',
            },
          ],
        }
      })
    },
  }
}

test('nothing raised draws nothing', () => {
  const { container } = render(<SearchPicker view={fakeView().view} />)
  expect(container.innerHTML).toBe('')
})

test('a raised picker lists each place with its track, and picking one reaches the view', () => {
  const { view, pick, raise } = fakeView()
  render(<SearchPicker view={view} />)
  raise()
  expect(screen.getByTestId('search-picker').textContent).toContain(
    '“BRC” matches 2 places',
  )
  const rows = screen.getAllByRole('button').slice(1)
  expect(rows.map(r => r.textContent.trim())).toEqual([
    'BRCA1 chr17:43,044,295..43,125,364 RefSeq',
    'BRCA1P1 chr17:43,000..44,000',
  ])
  fireEvent.click(rows[1]!)
  expect(pick).toHaveBeenCalledWith('b')
})

test('the close button closes the picker', () => {
  const { view, raise } = fakeView()
  render(<SearchPicker view={view} />)
  raise()
  fireEvent.click(screen.getByRole('button', { name: 'Close search results' }))
  expect(screen.queryByTestId('search-picker')).toBeNull()
})
