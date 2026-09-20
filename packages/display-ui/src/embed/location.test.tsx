import { act, fireEvent, render, screen } from '@testing-library/react'
import { observable, runInAction } from 'mobx'

import { LocationBox, useLocationBox } from './location.tsx'

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

test('a search that fails after a later one landed says nothing', async () => {
  const settle: Record<string, (error?: Error) => void> = {}
  const view = {
    coarseVisibleLocStrings: 'chr17:1..100',
    navToLocString: (text: string) =>
      new Promise<boolean>((resolve, reject) => {
        settle[text] = error => {
          if (error) {
            reject(error)
          } else {
            resolve(true)
          }
        }
      }),
  }
  function Buttons() {
    const box = useLocationBox(view)
    return (
      <>
        {['nothing', 'TP53'].map(query => (
          <button
            key={query}
            type="button"
            onClick={() => {
              box.go(query)
            }}
          >
            {query}
          </button>
        ))}
        {box.error ? <span role="alert">{String(box.error)}</span> : null}
        {box.pending ? <span role="status">pending</span> : null}
      </>
    )
  }
  render(<Buttons />)
  fireEvent.click(screen.getByText('nothing'))
  fireEvent.click(screen.getByText('TP53'))
  await act(async () => {
    settle.nothing!(new Error('no match'))
  })
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('pending')
  await act(async () => {
    settle.TP53!()
  })
  expect(screen.queryByRole('status')).toBeNull()
})
