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

function allRules() {
  return [...document.styleSheets].flatMap(sheet =>
    [...sheet.cssRules].map(rule => rule.cssText),
  )
}

function stylesOf(element: Element) {
  return allRules()
    .filter(rule =>
      [...element.classList].some(name => rule.startsWith(`.${name} `)),
    )
    .join(';')
}

test('a short value is whole, with no controls', () => {
  const { container, queryByText } = render(<BasicValue value="short" />)
  act(() => {
    reportHeight(40)
  })
  expect(container.textContent).toBe('short')
  expect(queryByText('Show more')).toBeNull()
  expect(queryByText('Copy')).toBeNull()
})

// a 300px block per value pushed a long read's panel past 2000px
test('long text is three clamped lines under Copy and Show more buttons', async () => {
  const note = 'word '.repeat(100)
  const { getByText } = render(<BasicValue value={note} />)
  const copyButton = getByText('Copy')
  const more = getByText('Show more')
  expect(copyButton.tagName).toBe('BUTTON')
  expect(more.tagName).toBe('BUTTON')
  const valueBox = more.nextElementSibling!
  expect(stylesOf(valueBox)).toMatch(/line-clamp: 3\b/)
  expect(valueBox.textContent).toBe(note)

  fireEvent.click(copyButton)
  await waitFor(() => {
    expect(copyToClipboard).toHaveBeenCalledWith(note)
  })
})

// a long read's SEQ runs to 100k+ characters, which slow the app in the DOM,
// and expanding it into a box that grew drew a 7000px drawer
test('long text keeps 2000 characters in the DOM until Show more puts all of it inline', async () => {
  const seq = 'ACGT'.repeat(1000)
  const { container, getByText } = render(<BasicValue value={seq} />)
  expect(container.textContent).not.toContain(seq)
  expect(container.textContent).toContain(seq.slice(0, 2000))

  fireEvent.click(getByText('Copy'))
  await waitFor(() => {
    expect(copyToClipboard).toHaveBeenCalledWith(seq)
  })

  fireEvent.click(getByText('Show more'))
  const valueBox = getByText('Show less').nextElementSibling!
  expect(valueBox.textContent).toBe(seq)
  expect(stylesOf(valueBox)).toBe('')
})

test('no value is faded', () => {
  const { getByText } = render(<BasicValue value={'ACGT'.repeat(1000)} />)
  fireEvent.click(getByText('Show more'))
  render(<BasicValue value="<pre>tall</pre>" />)
  act(() => {
    reportHeight(1200)
  })
  expect(allRules().join('')).not.toContain('mask')
})

// a file's header reaches the panel as escaped text in a <pre>, and a cut
// would end it mid-tag and give Copy the markup
test('a tall markup value is clipped at 300px whole, not cut, with a Show more link and no Copy', async () => {
  const lines = '##INFO=&lt;ID=DP,Number=1,Type=Integer&gt;\n'.repeat(100)
  const { container, getByText, queryByText } = render(
    <BasicValue value={`<pre>${lines}</pre>`} />,
  )
  await waitFor(() => {
    expect(container.querySelector('pre')?.textContent).toContain(
      '##INFO=<ID=DP,Number=1,Type=Integer>\n'.repeat(100),
    )
  })
  act(() => {
    reportHeight(1200)
  })
  const clip = container.firstElementChild!.firstElementChild!
  expect(getComputedStyle(clip).maxHeight).toBe('300px')
  expect(getComputedStyle(clip).overflowY).toBe('hidden')
  expect(queryByText('Copy')).toBeNull()

  fireEvent.click(getByText('Show more'))
  expect(getComputedStyle(clip).maxHeight).toBe('none')
  fireEvent.click(getByText('Show less'))
  expect(getComputedStyle(clip).maxHeight).toBe('300px')
})

test('a bare URL is never cut', () => {
  const url = `https://example.com/${'a'.repeat(3000)}`
  const { getByRole, queryByText } = render(<BasicValue value={url} />)
  expect(getByRole('link').getAttribute('href')).toBe(url)
  expect(queryByText('Copy')).toBeNull()
})
