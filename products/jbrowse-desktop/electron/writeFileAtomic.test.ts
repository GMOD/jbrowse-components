/**
 * @jest-environment node
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { writeFileAtomic } from './writeFileAtomic.ts'

jest.mock('electron', () => ({ app: {} }))

let dir: string
const platform = process.platform

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-atomic-'))
})

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: platform })
  jest.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})

function failRenames(times: number, code: string) {
  const rename = fs.promises.rename
  let failures = 0
  return jest
    .spyOn(fs.promises, 'rename')
    .mockImplementation(async (from, to) => {
      if (failures++ < times) {
        throw Object.assign(new Error(`${code}: rename`), { code })
      }
      return rename(from, to)
    })
}

// Antivirus and the search indexer hold a just-written file open for a moment,
// and Windows refuses a rename over it for that long; the autosave writes once
// a second, so failing outright was an error toast per save.
test('a rename Windows refuses for a moment is retried', async () => {
  Object.defineProperty(process, 'platform', { value: 'win32' })
  const rename = failRenames(2, 'EPERM')
  const file = path.join(dir, 'session.json')

  await writeFileAtomic(file, '{"a":1}')

  expect(rename).toHaveBeenCalledTimes(3)
  expect(fs.readFileSync(file, 'utf8')).toBe('{"a":1}')
  expect(fs.readdirSync(dir)).toEqual(['session.json'])
})

test('elsewhere the same codes fail at once and leave no temp file', async () => {
  Object.defineProperty(process, 'platform', { value: 'linux' })
  const rename = failRenames(1, 'EACCES')
  const file = path.join(dir, 'session.json')

  await expect(writeFileAtomic(file, '{}')).rejects.toThrow('EACCES')

  expect(rename).toHaveBeenCalledTimes(1)
  expect(fs.readdirSync(dir)).toEqual([])
})
