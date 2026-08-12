import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useLocalStorage } from './hooks.ts'

function Counter({
  storageKey,
  testId,
  enabled = true,
}: {
  storageKey: string
  testId: string
  enabled?: boolean
}) {
  const [n, setN] = useLocalStorage(storageKey, 0, enabled)
  return (
    <button
      data-testid={testId}
      onClick={() => {
        setN(v => v + 1)
      }}
    >
      {n}
    </button>
  )
}

beforeEach(() => {
  localStorage.clear()
  // the hook caches per key across tests in the module, so each test uses a
  // fresh key rather than trying to reach in and evict
})

test('persists and reads back', async () => {
  const user = userEvent.setup()
  render(<Counter storageKey="k-persist" testId="a" />)
  await user.click(screen.getByTestId('a'))
  expect(localStorage.getItem('k-persist')).toBe('1')
})

test('two instances on the same key stay in step', async () => {
  const user = userEvent.setup()
  render(
    <>
      <Counter storageKey="k-shared" testId="a" />
      <Counter storageKey="k-shared" testId="b" />
    </>,
  )
  await user.click(screen.getByTestId('a'))
  expect(screen.getByTestId('a').textContent).toBe('1')
  expect(screen.getByTestId('b').textContent).toBe('1')
})

test('successive functional updates in one tick both land', async () => {
  const user = userEvent.setup()
  function Twice() {
    const [n, setN] = useLocalStorage('k-twice', 0)
    return (
      <button
        data-testid="t"
        onClick={() => {
          setN(v => v + 1)
          setN(v => v + 1)
        }}
      >
        {n}
      </button>
    )
  }
  render(<Twice />)
  await user.click(screen.getByTestId('t'))
  expect(screen.getByTestId('t').textContent).toBe('2')
  expect(localStorage.getItem('k-twice')).toBe('2')
})

test('a write from another tab reaches a mounted instance', () => {
  render(<Counter storageKey="k-cross" testId="a" />)
  localStorage.setItem('k-cross', '7')
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'k-cross',
        newValue: '7',
        storageArea: localStorage,
      }),
    )
  })
  expect(screen.getByTestId('a').textContent).toBe('7')
})

test('enabled=false keeps the value out of storage entirely', async () => {
  const user = userEvent.setup()
  render(<Counter storageKey="k-off" testId="a" enabled={false} />)
  await user.click(screen.getByTestId('a'))
  expect(screen.getByTestId('a').textContent).toBe('1')
  expect(localStorage.getItem('k-off')).toBeNull()
})

// A store that refuses the write is the one case where re-reading it — the
// thing that keeps instances in step — reports the value the user just changed
// away from. Quota exhaustion and Safari private browsing both look like this,
// and without the fallback the control silently snaps back on every click.
test('a write the store refuses still moves the control', async () => {
  const user = userEvent.setup()
  const setItem = jest
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    render(<Counter storageKey="k-quota" testId="a" />)
    await user.click(screen.getByTestId('a'))
    expect(screen.getByTestId('a').textContent).toBe('1')
    // and it keeps counting from where it got to, rather than re-resolving
    // each update against the value the store never took
    await user.click(screen.getByTestId('a'))
    expect(screen.getByTestId('a').textContent).toBe('2')
  } finally {
    setItem.mockRestore()
    warn.mockRestore()
  }
})
