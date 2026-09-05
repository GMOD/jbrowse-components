import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { DEFAULT_WIDTH } from './options.ts'
import { convert, isFile } from './util.ts'

jest.mock('node:child_process', () => ({ spawnSync: jest.fn() }))

const mockSpawnSync = jest.mocked(spawnSync)

beforeEach(() => {
  mockSpawnSync.mockReset()
})

describe('convert', () => {
  function result(over: Partial<ReturnType<typeof spawnSync>>) {
    return {
      pid: 1,
      output: [],
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
      status: 0,
      signal: null,
      ...over,
    } as ReturnType<typeof spawnSync>
  }

  test('a missing rsvg-convert binary reports how to install librsvg', () => {
    // spawn failure leaves stdout/stderr unset — the real ENOENT must still
    // surface rather than a "cannot read toString of undefined".
    mockSpawnSync.mockReturnValue(
      result({
        error: Object.assign(new Error('spawnSync rsvg-convert ENOENT'), {
          code: 'ENOENT',
        }),
        stdout: undefined,
        stderr: undefined,
        status: null,
      }),
    )
    expect(() => {
      convert('<svg/>', { out: 'out.png' })
    }).toThrow(/librsvg/)
  })

  test('a nonzero exit code is surfaced', () => {
    // convert() console.errors any non-empty stderr before throwing on the
    // nonzero status, so a console.error here is expected
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    mockSpawnSync.mockReturnValue(
      result({ status: 1, stderr: Buffer.from('boom') }),
    )
    expect(() => {
      convert('<svg/>', { out: 'out.png' })
    }).toThrow(/exited with/)
    consoleError.mockRestore()
  })

  test('a successful conversion does not throw', () => {
    mockSpawnSync.mockReturnValue(result({ status: 0 }))
    expect(() => {
      convert('<svg/>', { out: 'out.png' })
    }).not.toThrow()
  })

  test('an omitted width falls back to the CLI default width', () => {
    mockSpawnSync.mockReturnValue(result({ status: 0 }))
    convert('<svg/>', { out: 'out.png' })
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'rsvg-convert',
      ['-w', String(DEFAULT_WIDTH), '-o', 'out.png'],
      { input: '<svg/>' },
    )
  })
})

describe('isFile', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-isFile-'))

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('a directory of the same name as an assembly is not a file', () => {
    const dir = path.join(tmpDir, 'hg38')
    fs.mkdirSync(dir)
    expect(isFile(dir)).toBe(false)
  })

  test('an existing file is, a missing one is not', () => {
    const file = path.join(tmpDir, 'assembly.json')
    fs.writeFileSync(file, '{}')
    expect(isFile(file)).toBe(true)
    expect(isFile(path.join(tmpDir, 'missing.json'))).toBe(false)
  })

  test('inline JSON too long to be a path is not a file', () => {
    expect(isFile(`{"type":"DotplotView"}`.padEnd(5000, ' '))).toBe(false)
  })
})
