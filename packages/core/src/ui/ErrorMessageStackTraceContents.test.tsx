import { cleanup, fireEvent, render } from '@testing-library/react'

import ErrorMessageStackTraceContents from './ErrorMessageStackTraceContents.tsx'
import { withoutSharePassword } from './errorReportEmail.ts'

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

function mockFetch(ok: boolean) {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('{}', { status: ok ? 200 : 500 }))
}

test('Send report posts the shown text with the note and address', async () => {
  const fetchSpy = mockFetch(true)
  const { getByLabelText, getByText, findByText } = render(
    <ErrorMessageStackTraceContents
      text="TypeError: boom"
      extra={{ trackId: 'genes' }}
    />,
  )
  fireEvent.change(getByLabelText(/What were you doing/), {
    target: { value: 'opened a BAM' },
  })
  fireEvent.change(getByLabelText(/Your email/), {
    target: { value: 'me@example.org' },
  })
  fireEvent.click(getByText('Send report'))
  await findByText(/The JBrowse team has your report/)

  const [url, init] = fetchSpy.mock.calls[0]!
  expect(url).toBe('https://api.jbrowse.org/errors/v1/report')
  expect(JSON.parse(`${init?.body}`)).toEqual({
    report: 'TypeError: boom\nsupporting data: {\n  "trackId": "genes"\n}',
    comment: 'opened a BAM',
    email: 'me@example.org',
  })
  expect(getByText('Sent').closest('button')?.disabled).toBe(true)
})

test('the dialog says a report is anonymous unless an email is added', () => {
  const { getByText } = render(
    <ErrorMessageStackTraceContents text="TypeError: boom" />,
  )
  expect(
    getByText(
      /Reports are anonymous, so we can't reply unless you add your email/,
    ),
  ).toBeTruthy()
})

test('a failed send points at the email address', async () => {
  mockFetch(false)
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { getByText, findByText } = render(
    <ErrorMessageStackTraceContents text="TypeError: boom" />,
  )
  fireEvent.click(getByText('Send report'))
  await findByText(/could not be sent/)
  expect(
    getByText('jbrowse2@berkeley.edu').closest('a')?.getAttribute('href'),
  ).toMatch(/^mailto:jbrowse2@berkeley\.edu\?/)
})

test('the page address in a report hides a share link password', () => {
  expect(
    withoutSharePassword(
      'https://jbrowse.org/code/jb2/main/?session=share-abc&password=secret',
    ),
  ).toBe(
    'https://jbrowse.org/code/jb2/main/?session=share-abc&password=redacted',
  )
  expect(withoutSharePassword('https://example.org/?config=a.json')).toBe(
    'https://example.org/?config=a.json',
  )
})
