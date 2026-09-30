import { act, fireEvent, render } from '@testing-library/react'

import BasicValue from './BasicValue.tsx'

const stubbed = globalThis.ResizeObserver
let reportHeight: (height: number) => void

beforeEach(() => {
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      reportHeight = height => {
        callback(
          [
            {
              contentBoxSize: [{ inlineSize: 400, blockSize: height }],
            } as unknown as ResizeObserverEntry,
          ],
          this,
        )
      }
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  globalThis.ResizeObserver = stubbed
})

test('a value that fits has no toggle', () => {
  const { queryByText } = render(<BasicValue value="short" />)
  act(() => {
    reportHeight(40)
  })
  expect(queryByText('Show more')).toBeNull()
})

// the value used to scroll inside a 300px box, itself inside a scrolling
// dialog or widget, and nothing said where it ended
test('a tall value is clipped until expanded, with no scroller of its own', () => {
  const { getByText, container } = render(<BasicValue value="long" />)
  act(() => {
    reportHeight(1200)
  })
  const clip = container.firstElementChild!.firstElementChild!
  expect(getComputedStyle(clip).maxHeight).toBe('300px')
  expect(getComputedStyle(clip).overflowY).toBe('hidden')

  fireEvent.click(getByText('Show more'))
  expect(getComputedStyle(clip).maxHeight).toBe('')
  fireEvent.click(getByText('Show less'))
  expect(getComputedStyle(clip).maxHeight).toBe('300px')
})
