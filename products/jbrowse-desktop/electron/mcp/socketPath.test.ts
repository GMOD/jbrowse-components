/**
 * @jest-environment node
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  defaultSocketPath,
  ensureSocketDir,
  socketDirStatus,
  socketPaths,
} from './socketPath.ts'

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jb-socket-dir-test-'))
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('socketDirStatus, the test the app and the shim share', () => {
  it('is undefined for a missing directory, which the shim treats as "launch the app"', () => {
    expect(socketDirStatus(path.join(tempDir(), 'absent'))).toBeUndefined()
  })

  it('passes a 0700 directory this account owns', () => {
    const dir = tempDir()
    fs.chmodSync(dir, 0o700)
    expect(socketDirStatus(dir)).toEqual({ unsafe: undefined })
  })

  it.each(['0750', '0705', '0755', '0777'])(
    'refuses mode %s, which lets other accounts in',
    mode => {
      const dir = tempDir()
      fs.chmodSync(dir, Number.parseInt(mode, 8))
      expect(socketDirStatus(dir)?.unsafe).toContain(`${dir} has mode ${mode}`)
    },
  )

  it('refuses a symbolic link, even to a good directory', () => {
    const target = tempDir()
    const link = path.join(tempDir(), 'link')
    fs.symlinkSync(target, link)
    expect(socketDirStatus(link)?.unsafe).toContain(
      `${link} is a symbolic link`,
    )
  })

  it('refuses something that is not a directory', () => {
    const file = path.join(tempDir(), 'file')
    fs.writeFileSync(file, '', { mode: 0o600 })
    expect(socketDirStatus(file)?.unsafe).toContain(
      `${file} is not a directory`,
    )
  })

  it('refuses a directory another account owns', () => {
    const dir = tempDir()
    const uid = os.userInfo().uid
    jest.spyOn(process, 'getuid').mockReturnValue(uid + 1)
    expect(socketDirStatus(dir)?.unsafe).toContain(`belongs to uid ${uid}`)
  })
})

describe('ensureSocketDir, before the app listens', () => {
  it('creates a missing directory with mode 0700', () => {
    const dir = path.join(tempDir(), 'mcp')
    ensureSocketDir(dir)
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700)
  })

  it('accepts its own directory from an earlier run', () => {
    const dir = tempDir()
    fs.chmodSync(dir, 0o700)
    expect(() => {
      ensureSocketDir(dir)
    }).not.toThrow()
  })

  it('refuses a planted directory rather than adopting it', () => {
    const dir = tempDir()
    fs.chmodSync(dir, 0o755)
    expect(() => {
      ensureSocketDir(dir)
    }).toThrow(`${dir} has mode 0755`)
    expect(fs.statSync(dir).mode & 0o777).toBe(0o755)
  })

  it('refuses a symbolic link', () => {
    const link = path.join(tempDir(), 'link')
    fs.symlinkSync(tempDir(), link)
    expect(() => {
      ensureSocketDir(link)
    }).toThrow(`${link} is a symbolic link`)
  })
})

const onLinux = process.platform === 'linux' ? describe : describe.skip

onLinux('the rendezvous on Linux', () => {
  const saved = process.env.XDG_RUNTIME_DIR
  afterEach(() => {
    if (saved === undefined) {
      delete process.env.XDG_RUNTIME_DIR
    } else {
      process.env.XDG_RUNTIME_DIR = saved
    }
  })

  it('is served from $XDG_RUNTIME_DIR, and the shim tries it first and tmpdir last', () => {
    const runtime = tempDir()
    process.env.XDG_RUNTIME_DIR = runtime
    const served = path.join(runtime, 'jbrowse-desktop-mcp', 'mcp.sock')
    expect(defaultSocketPath()).toBe(served)
    expect(socketPaths()[0]).toBe(served)
    expect(path.dirname(path.dirname(socketPaths().at(-1) ?? ''))).toBe(
      os.tmpdir(),
    )
  })

  it('ignores a relative $XDG_RUNTIME_DIR', () => {
    process.env.XDG_RUNTIME_DIR = 'relative/dir'
    expect(socketPaths().some(p => p.includes('relative'))).toBe(false)
  })
})
