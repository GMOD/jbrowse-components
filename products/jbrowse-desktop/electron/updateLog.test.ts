/**
 * @jest-environment node
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createUpdateLog } from './updateLog.ts'

let dir: string
let logPath: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jbrowse-update-log-'))
  logPath = path.join(dir, 'update.log')
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  jest.restoreAllMocks()
})

test('every level reaches the file, and the console too', () => {
  const log = createUpdateLog(logPath)
  log.info('checking')
  log.warn('slow')
  log.error(new Error('boom'))
  log.debug('detail')

  const written = fs.readFileSync(logPath, 'utf8')
  expect(written).toContain('info checking')
  expect(written).toContain('warn slow')
  expect(written).toContain('error Error: boom')
  expect(written).toContain('debug detail')
  // an error's stack is the half worth having after the fact
  expect(written).toContain('updateLog.test.ts')
  expect(console.log).toHaveBeenCalledWith('checking')
  expect(console.error).toHaveBeenCalled()
})

// Applying an update quits and relaunches the app, so the launch after an
// install must not be the one that erases the account of it.
test('a relaunch appends rather than starting fresh', () => {
  createUpdateLog(logPath).info('before the install')
  createUpdateLog(logPath).info('after the relaunch')

  const written = fs.readFileSync(logPath, 'utf8')
  expect(written).toContain('before the install')
  expect(written).toContain('after the relaunch')
})

test('an oversized log rotates instead of growing', () => {
  fs.writeFileSync(logPath, 'x'.repeat(256 * 1024 + 1))
  createUpdateLog(logPath).info('first line of the new window')

  const written = fs.readFileSync(logPath, 'utf8')
  expect(written).toContain('first line')
  expect(written).not.toContain('xx')
  // the window it replaced is still there to read
  expect(fs.statSync(`${logPath}.old`).size).toBe(256 * 1024 + 1)
})

// A log that cannot be written must not be why an update fails.
test('an unwritable path costs nothing but the log', () => {
  const log = createUpdateLog(path.join(dir, 'missing', 'update.log'))
  expect(() => {
    log.info('checking')
  }).not.toThrow()
  expect(console.log).toHaveBeenCalledWith('checking')
})
