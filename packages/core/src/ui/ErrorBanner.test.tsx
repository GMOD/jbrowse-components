import '@testing-library/jest-dom'

import { fireEvent, render, within } from '@testing-library/react'

import Dialog from './Dialog.tsx'
import ErrorBanner from './ErrorBanner.tsx'
import { ErrorMessage } from './index.ts'

// The button opens the report dialog, whose value is the environment block and
// the prefilled issue link, not the trace — so an error thrown as a string, or
// any value that never carried a `stack`, still needs it.
test.each([
  ['an Error', new Error('boom')],
  ['a string', 'boom'],
  ['a plain object', { message: 'boom' }],
])('offers the stack trace dialog for %s', (_name, error) => {
  const { getByRole } = render(<ErrorBanner error={error} />)

  expect(getByRole('button', { name: 'Show stack trace' })).toBeInTheDocument()
})

test('the ErrorMessage plugins import offers the stack trace dialog', () => {
  const { getByRole } = render(<ErrorMessage error={new Error('boom')} />)

  expect(getByRole('button', { name: 'Show stack trace' })).toBeInTheDocument()
})

test('the stack trace dialog opens over the dialog showing the error', async () => {
  Object.defineProperty(globalThis, 'crossOriginIsolated', {
    value: false,
    configurable: true,
  })
  const { getByRole, findByRole } = render(
    <Dialog open title="Add track" onClose={() => {}}>
      <ErrorBanner error={new Error('boom')} />
    </Dialog>,
  )

  fireEvent.click(getByRole('button', { name: 'Show stack trace' }))

  const traceDialog = await findByRole('dialog', { name: /Stack trace/ })
  expect(within(traceDialog).getAllByText(/boom/).length).toBeGreaterThan(0)
})

test.each([
  ['a webpack ChunkLoadError', new Error('Loading chunk 42 failed.')],
  [
    'a failed dynamic import',
    new TypeError('Failed to fetch dynamically imported module: /x.js'),
  ],
])('offers a page refresh instead of a report for %s', (_name, error) => {
  const { getByRole, queryByRole } = render(<ErrorMessage error={error} />)

  expect(getByRole('button', { name: 'Refresh page' })).toBeInTheDocument()
  expect(queryByRole('button', { name: 'Show stack trace' })).toBeNull()
})
