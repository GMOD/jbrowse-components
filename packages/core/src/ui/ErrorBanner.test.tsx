import '@testing-library/jest-dom'

import { render } from '@testing-library/react'

import ErrorBanner from './ErrorBanner.tsx'

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
