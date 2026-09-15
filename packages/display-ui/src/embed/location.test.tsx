import { act, fireEvent, render, screen } from '@testing-library/react'
import { observable, runInAction } from 'mobx'

import { LocationBox } from './location.tsx'

function fakeView(fail?: (input: string) => Error | undefined) {
  const view = observable({
    coarseVisibleLocStrings: 'chr17:1..100',
    navToLocString(input: string) {
      const error = fail?.(input)
      if (error) {
        return Promise.reject(error)
      }
      runInAction(() => {
        view.coarseVisibleLocStrings = input
      })
      return Promise.resolve(true)
    },
  })
  return view
}

function input() {
  return screen.getByLabelText<HTMLInputElement>('Location')
}

test('the box follows the view until someone types, and navigates on submit', async () => {
  const view = fakeView()
  render(<LocationBox view={view} />)
  expect(input().value).toBe('chr17:1..100')

  act(() => {
    runInAction(() => {
      view.coarseVisibleLocStrings = 'chr17:50..150'
    })
  })
  expect(input().value).toBe('chr17:50..150')

  fireEvent.change(input(), { target: { value: 'chr13' } })
  act(() => {
    runInAction(() => {
      view.coarseVisibleLocStrings = 'chr17:60..160'
    })
  })
  expect(input().value).toBe('chr13')

  await act(async () => {
    fireEvent.submit(input())
  })
  expect(input().value).toBe('chr13')
  act(() => {
    runInAction(() => {
      view.coarseVisibleLocStrings = 'chr13:1..10'
    })
  })
  expect(input().value).toBe('chr13:1..10')
})

test('a location the view cannot resolve keeps the draft and says why, until Escape', async () => {
  const view = fakeView(
    text => new Error(`Unknown reference sequence "${text}"`),
  )
  render(<LocationBox view={view} />)

  fireEvent.change(input(), { target: { value: 'chrZ' } })
  await act(async () => {
    fireEvent.submit(input())
  })
  expect(screen.getByRole('alert').textContent).toBe(
    'Unknown reference sequence "chrZ"',
  )
  expect(input().value).toBe('chrZ')

  fireEvent.keyDown(input(), { key: 'Escape' })
  expect(screen.queryByRole('alert')).toBeNull()
  expect(input().value).toBe('chr17:1..100')
})
