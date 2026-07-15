import { cleanup, render } from '@testing-library/react'

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
