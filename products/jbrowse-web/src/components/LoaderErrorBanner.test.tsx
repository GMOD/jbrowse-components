import { render } from '@testing-library/react'

import {
  addPermanentPlugin,
  clearPermanentPlugins,
} from '../permanentPlugins.ts'
import LoaderErrorBanner from './LoaderErrorBanner.tsx'

afterEach(() => {
  clearPermanentPlugins()
})

test('a load error offers a way off the screen', () => {
  const { getByText } = render(
    <LoaderErrorBanner error={new Error('Failed to load script: bad.js')} />,
  )
  getByText(/Failed to load script/)
  getByText(/Start over without URL options/)
})

// a permanent plugin that throws in configure() fails every load, and with the
// default config the bare url still loads it
test('a load error offers to skip the permanent plugins when there are some', () => {
  const { queryByText, rerender } = render(
    <LoaderErrorBanner error={new Error('boom')} />,
  )
  expect(queryByText(/Reload without permanent plugins/)).toBeNull()
  addPermanentPlugin({ name: 'Bad', url: 'https://example.com/bad.js' })
  rerender(<LoaderErrorBanner error={new Error('boom again')} />)
  expect(queryByText(/Reload without permanent plugins/)).not.toBeNull()
})

test('a missing config.json is the fresh-install greeting, not an error', () => {
  const { getByText, queryByText } = render(
    <LoaderErrorBanner error={new Error('HTTP 404 fetching config.json')} />,
  )
  getByText('It worked!')
  expect(queryByText(/Start over without URL options/)).toBeNull()
})
