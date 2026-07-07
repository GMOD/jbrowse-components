import { spawnSync } from 'node:child_process'

import { booleanize, convert } from './util.ts'

jest.mock('node:child_process', () => ({ spawnSync: jest.fn() }))

const mockSpawnSync = jest.mocked(spawnSync)

beforeEach(() => {
  mockSpawnSync.mockReset()
})

describe('booleanize', () => {
  test('"false" is false, empty is false, anything else is true', () => {
    expect(booleanize('false')).toBe(false)
    expect(booleanize('')).toBe(false)
    expect(booleanize('true')).toBe(true)
    expect(booleanize('yes')).toBe(true)
  })
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
})
