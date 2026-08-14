import { cleanup, fireEvent, render } from '@testing-library/react'

import { ErrorBoundary } from './ErrorBoundary.tsx'

afterEach(cleanup)

function Boom(): React.ReactElement {
  throw new Error('boom')
}

test('renders children when nothing throws', () => {
  const { getByText } = render(
    <ErrorBoundary FallbackComponent={() => <div>fallback</div>}>
      <div>ok</div>
    </ErrorBoundary>,
  )
  expect(getByText('ok')).toBeTruthy()
})

test('passes the error and componentStack to the fallback', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  let captured: { error: unknown; componentStack?: string } | undefined
  const { getByText } = render(
    <ErrorBoundary
      FallbackComponent={props => {
        captured = props
        return <div>fallback</div>
      }}
    >
      <Boom />
    </ErrorBoundary>,
  )
  expect(getByText('fallback')).toBeTruthy()
  expect(String(captured?.error)).toContain('boom')
  expect(captured?.componentStack).toContain('Boom')
  spy.mockRestore()
})

// The state was terminal before this: a track that threw once stayed a red
// banner for the rest of the session, however transient the cause.
test('the fallback can clear the error', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  let broken = true
  function Child() {
    if (broken) {
      throw new Error('boom')
    }
    return <div>recovered</div>
  }
  const onReset = jest.fn()
  const { getByText } = render(
    <ErrorBoundary
      onReset={onReset}
      FallbackComponent={({ resetErrorBoundary }) => (
        <button
          onClick={() => {
            broken = false
            resetErrorBoundary()
          }}
        >
          retry
        </button>
      )}
    >
      <Child />
    </ErrorBoundary>,
  )

  fireEvent.click(getByText('retry'))

  expect(getByText('recovered')).toBeTruthy()
  expect(onReset).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

test('a resetKeys change clears the error', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  let broken = true
  function Child() {
    if (broken) {
      throw new Error('boom')
    }
    return <div>recovered</div>
  }
  function Harness({ k }: { k: string }) {
    return (
      <ErrorBoundary
        resetKeys={[k]}
        FallbackComponent={() => <div>fallback</div>}
      >
        <Child />
      </ErrorBoundary>
    )
  }
  const { getByText, rerender } = render(<Harness k="a" />)
  expect(getByText('fallback')).toBeTruthy()

  broken = false
  rerender(<Harness k="b" />)

  expect(getByText('recovered')).toBeTruthy()
  spy.mockRestore()
})

test('equal resetKeys, freshly allocated each render, do not clear it', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  function Harness() {
    return (
      <ErrorBoundary
        resetKeys={['a', 1]}
        FallbackComponent={() => <div>fallback</div>}
      >
        <Boom />
      </ErrorBoundary>
    )
  }
  const { getByText, rerender } = render(<Harness />)
  rerender(<Harness />)
  expect(getByText('fallback')).toBeTruthy()
  spy.mockRestore()
})

// The loop the `keysAtError` snapshot exists to prevent: a key change and the
// throw it caused arrive in the SAME update, so "the keys differ from the
// previous props" is true at the moment the error is caught. Resetting on that
// re-renders the children that just threw, forever.
test('a throw arriving with the key change does not loop', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  let renders = 0
  function Child({ k }: { k: string }) {
    renders++
    if (k === 'b') {
      throw new Error('boom')
    }
    return <div>ok</div>
  }
  function Harness({ k }: { k: string }) {
    return (
      <ErrorBoundary
        resetKeys={[k]}
        FallbackComponent={() => <div>fallback</div>}
      >
        <Child k={k} />
      </ErrorBoundary>
    )
  }
  const { getByText, rerender } = render(<Harness k="a" />)
  const before = renders

  rerender(<Harness k="b" />)

  expect(getByText('fallback')).toBeTruthy()
  // React re-runs a failing subtree once before handing it to componentDidCatch,
  // so a couple of attempts is normal and an unbounded count is the regression
  expect(renders - before).toBeLessThan(5)
  spy.mockRestore()
})
