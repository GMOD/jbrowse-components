import { act, fireEvent, render, waitFor } from '@testing-library/react'

import copyToClipboard from '../../util/copyToClipboard.ts'
import BasicValue from './BasicValue.tsx'

jest.mock('../../util/copyToClipboard.ts')

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
  expect(getComputedStyle(clip).maxHeight).toBe('none')
  fireEvent.click(getByText('Show less'))
  expect(getComputedStyle(clip).maxHeight).toBe('300px')
})

// a long read's SEQ runs to 100k+ characters, which slow the app in the DOM
test('a value past the cut-off is cut until expanded, and Copy takes all of it', async () => {
  const seq = 'ACGT'.repeat(1000)
  const { container, getByText } = render(<BasicValue value={seq} />)
  expect(container.textContent).not.toContain(seq)
  expect(container.textContent).toContain(`${seq.slice(0, 2000)}…`)

  fireEvent.click(getByText('Copy'))
  await waitFor(() => {
    expect(copyToClipboard).toHaveBeenCalledWith(seq)
  })

  fireEvent.click(getByText('Show more'))
  expect(container.textContent).toContain(seq)
})

test('ordinary long text is whole, left to the clamp', () => {
  const note = 'word '.repeat(300)
  const { container, queryByText } = render(<BasicValue value={note} />)
  expect(container.textContent).toContain(note)
  expect(queryByText('Copy')).toBeNull()
})

test('a cut HTML value previews as HTML, not as its tags', () => {
  const { container } = render(
    <BasicValue value={`<b>bold</b> ${'A'.repeat(3000)}`} />,
  )
  expect(container.querySelector('b')?.textContent).toBe('bold')
  expect(container.textContent).not.toContain('<b>')
})

test('a bare URL is never cut', () => {
  const url = `https://example.com/${'a'.repeat(3000)}`
  const { getByRole, queryByText } = render(<BasicValue value={url} />)
  expect(getByRole('link').getAttribute('href')).toBe(url)
  expect(queryByText('Copy')).toBeNull()
})
