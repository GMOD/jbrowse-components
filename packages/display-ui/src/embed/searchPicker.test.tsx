import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { SearchPicker } from './searchPicker.tsx'

const hits = [
  new BaseResult({
    label: 'BRCA1',
    locString: 'chr17:43,044,295..43,125,364',
    trackId: 'genes',
  }),
  new BaseResult({ label: 'BRCA1P1', locString: 'chr17:43,000..44,000' }),
]

const FakeView = types
  .model({})
  .volatile(() => ({
    searchPicker: undefined as
      | {
          query: string
          assemblyName: string
          results: BaseResult[]
          pick: (result: BaseResult) => Promise<unknown>
        }
      | undefined,
  }))
  .actions(self => ({
    raise(pick: (result: BaseResult) => Promise<unknown>) {
      self.searchPicker = {
        query: 'BRC',
        assemblyName: 'hg38',
        results: hits,
        pick,
      }
    },
    closeSearchPicker() {
      self.searchPicker = undefined
    },
  }))

const FakeSession = types
  .model({ views: types.array(FakeView) })
  .volatile(() => ({
    rpcManager: {},
    configuration: {},
    assemblyManager: { get: () => undefined },
    getTrackById: (id: string) =>
      id === 'genes' ? { name: 'RefSeq' } : undefined,
  }))

test('nothing raised draws nothing', () => {
  const session = FakeSession.create({ views: [{}] })
  const { container } = render(<SearchPicker view={session.views[0]!} />)
  expect(container.innerHTML).toBe('')
})

test('a raised picker lists each place with its track, and picking one reaches the view', () => {
  const session = FakeSession.create({ views: [{}] })
  const view = session.views[0]!
  const pick = jest.fn(() => Promise.resolve())
  render(<SearchPicker view={view} />)
  act(() => {
    view.raise(pick)
  })
  expect(screen.getByTestId('search-picker').textContent).toContain(
    '“BRC” matches 2 places',
  )
  const rows = screen.getAllByRole('button').slice(1)
  expect(rows.map(r => r.textContent.trim())).toEqual([
    'BRCA1 chr17:43,044,295..43,125,364 RefSeq',
    'BRCA1P1 chr17:43,000..44,000',
  ])
  fireEvent.click(rows[1]!)
  expect(pick).toHaveBeenCalledWith(hits[1])
})

test('the close button closes the picker', () => {
  const session = FakeSession.create({ views: [{}] })
  const view = session.views[0]!
  render(<SearchPicker view={view} />)
  act(() => {
    view.raise(jest.fn(() => Promise.resolve()))
  })
  fireEvent.click(screen.getByRole('button', { name: 'Close search results' }))
  expect(screen.queryByTestId('search-picker')).toBeNull()
})
