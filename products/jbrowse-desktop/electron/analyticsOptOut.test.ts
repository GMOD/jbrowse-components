/**
 * @jest-environment node
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ANALYTICS_OPT_OUT_FILE, analyticsOptedOut } from './analyticsOptOut.ts'

const resources = fs.mkdtempSync(path.join(os.tmpdir(), 'jbrowse-optout-'))

afterAll(() => {
  fs.rmSync(resources, { recursive: true, force: true })
})

test('no file means the usage report was left on', () => {
  expect(analyticsOptedOut(resources)).toBe(false)
})

// Nothing reads the contents — an installer writing an empty file is the whole
// signal, so a zero-byte one has to count.
test('an empty file is still an opt-out', () => {
  fs.writeFileSync(path.join(resources, ANALYTICS_OPT_OUT_FILE), '')
  expect(analyticsOptedOut(resources)).toBe(true)
})

// A dev run has no packaged resources directory at all, and reading that as an
// opt-out would turn the report off for every developer instead.
test('a resources directory that is not there is not an opt-out', () => {
  expect(analyticsOptedOut(path.join(resources, 'nope'))).toBe(false)
})
