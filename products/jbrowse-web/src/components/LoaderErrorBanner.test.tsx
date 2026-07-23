import { render } from '@testing-library/react'

import LoaderErrorBanner from './LoaderErrorBanner.tsx'

test('a load error offers a way off the screen', () => {
  const { getByText } = render(
    <LoaderErrorBanner error={new Error('Failed to load script: bad.js')} />,
  )
  getByText(/Failed to load script/)
  getByText(/Start over without URL options/)
})

test('a missing config.json is the fresh-install greeting, not an error', () => {
  const { getByText, queryByText } = render(
    <LoaderErrorBanner error={new Error('HTTP 404 fetching config.json')} />,
  )
  getByText('It worked!')
  expect(queryByText(/Start over without URL options/)).toBeNull()
})
