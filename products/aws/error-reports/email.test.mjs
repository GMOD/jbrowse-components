import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildEmail, parseReport } from './src/email.mjs'

const route = { from: 'error-reports@jbrowse.org', to: 'jbrowse2@berkeley.edu' }

test('a report without text, or a body that is not JSON, is refused', () => {
  assert.equal(parseReport(JSON.stringify({ report: '  ' })), undefined)
  assert.equal(parseReport('not json'), undefined)
  assert.equal(parseReport(undefined), undefined)
})

test('the email names the first line of the report and carries the note', () => {
  const fields = parseReport(
    JSON.stringify({
      report: '\nTypeError: x is undefined\n    at f (a.js:1)',
      comment: 'opened a BAM',
      email: 'someone@example.org',
    }),
  )
  const email = buildEmail(fields, route)
  assert.equal(
    email.Content.Simple.Subject.Data,
    'JBrowse error report: TypeError: x is undefined',
  )
  assert.deepEqual(email.Destination.ToAddresses, ['jbrowse2@berkeley.edu'])
  assert.deepEqual(email.ReplyToAddresses, ['someone@example.org'])
  assert.equal(
    email.Content.Simple.Body.Text.Data,
    'Reply to: someone@example.org\n\nWhat they were doing:\nopened a BAM\n\nTypeError: x is undefined\n    at f (a.js:1)',
  )
})

test('an address that is not an email address is dropped, not used as Reply-To', () => {
  const fields = parseReport(
    JSON.stringify({ report: 'Error', email: 'a@b.c\nBcc: x@y.z' }),
  )
  const email = buildEmail(fields, route)
  assert.equal(email.ReplyToAddresses, undefined)
  assert.match(email.Content.Simple.Body.Text.Data, /no address given/)
})

test('a long report is clipped and the subject stays one line', () => {
  const fields = parseReport(
    JSON.stringify({ report: `${'a'.repeat(300)}\r\nb`.repeat(1000) }),
  )
  const email = buildEmail(fields, route)
  assert.equal(fields.report.length, 100_000)
  assert.doesNotMatch(email.Content.Simple.Subject.Data, /[\r\n]/)
})
