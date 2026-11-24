import { cleanup, render } from '@testing-library/react'

import packageJSON from '../../package.json' with { type: 'json' }
import ErrorReport from './ErrorReport.tsx'

afterEach(cleanup)

test('a report names the version with no session global, as an embedded view has', async () => {
  expect('JBrowseSession' in window).toBe(false)
  const { findByTestId } = render(
    <ErrorReport error={new Error('boom')} componentStack={'\n    at Track'} />,
  )
  const text = (await findByTestId('error-report-text')).textContent
  expect(text).toContain('Error: boom')
  expect(text).toContain('--- component stack ---\n    at Track')
  expect(text).toContain(`JBrowse ${packageJSON.version}\n`)
})
