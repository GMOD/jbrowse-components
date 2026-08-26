import { createReadStream, readFileSync, realpathSync, rmSync } from 'node:fs'
import { mkdir, mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'

import { main as nativeMain } from './index.ts'

// increase test timeout for all tests
// jest.setTimeout(20000)

// On macOS, os.tmpdir() is not a real path:
// https://github.com/nodejs/node/issues/11422
const tmpDir = realpathSync(os.tmpdir())

export async function runInTmpDir(
  callbackFn: (args: { dir: string; originalDir: string }) => Promise<void>,
) {
  const originalDir = process.cwd()
  let dir: string | undefined
  try {
    const jbrowseTmpDir = path.join(tmpDir, 'jbrowse')
    await mkdir(jbrowseTmpDir, { recursive: true })
    dir = await mkdtemp(path.join(jbrowseTmpDir, path.sep))
    process.chdir(dir)
    await callbackFn({ dir, originalDir })
  } finally {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
    process.chdir(originalDir)
  }
}

function pollForOutput(received: () => boolean, attempts = 10) {
  return new Promise<void>(resolve => {
    const check = (remaining: number) => {
      if (received() || remaining === 0) {
        resolve()
      } else {
        setTimeout(() => {
          check(remaining - 1)
        }, 10)
      }
    }
    check(attempts)
  })
}

// Native command runner for testing
export async function runCommand(args: string | string[]): Promise<{
  stdout: string
  stderr: string
  warnings: string
  error?: Error
}> {
  let stdout = ''
  let stderr = ''
  // console.warn is kept apart from stderr: a warning is not a failure, and
  // stderr below gets promoted into `error`. Capturing it at all keeps warnings
  // assertable instead of leaking to the real console.
  let warnings = ''
  let error: Error | undefined
  let outputReceived = false

  const format = (args: unknown[]) => `${args.join(' ')}\n`

  // Mock console functions using Jest spies
  const consoleLogSpy = jest
    .spyOn(console, 'log')
    .mockImplementation((...args: unknown[]) => {
      stdout += format(args)
      outputReceived = true
    })

  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => {
      stderr += format(args)
      outputReceived = true
    })

  const consoleWarnSpy = jest
    .spyOn(console, 'warn')
    .mockImplementation((...args: unknown[]) => {
      warnings += format(args)
      outputReceived = true
    })

  // The captured buffers below are strings, not a terminal, so the mocked
  // streams have to say so: cli-progress draws its bar only when isTTY, and the
  // spy would otherwise fold that decoration into stderr, which becomes `error`.
  // Without this a text-index test passes piped and fails from a terminal.
  const originalIsTTY = {
    stdout: process.stdout.isTTY,
    stderr: process.stderr.isTTY,
  }
  process.stdout.isTTY = false
  process.stderr.isTTY = false

  // Mock process.stdout.write
  const stdoutWriteSpy = jest
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stdout += chunk.toString()
      outputReceived = true
      return true
    })

  // Mock process.stderr.write
  const stderrWriteSpy = jest
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      stderr += chunk.toString()
      outputReceived = true
      return true
    })

  // Mock process.exit
  const processExitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation((code?: string | number | null) => {
      if (code && code !== 0) {
        error = new Error(stderr.trim() || `Process exited with code ${code}`)
      }
      throw new Error('EXIT_MOCK')
    })

  try {
    // Parse arguments
    const argsArray = Array.isArray(args) ? args : args.split(' ')

    // Run the native command with args directly instead of mutating process.argv
    await nativeMain(argsArray)

    // Commands that start a server (admin-server) log from a callback that runs
    // after main() resolves, so poll briefly for that first line. A command that
    // already printed returns on the first check, rather than paying an
    // unconditional ~50ms across every runCommand in the suite.
    await pollForOutput(() => outputReceived)
  } catch (err) {
    if (err instanceof Error && err.message !== 'EXIT_MOCK') {
      error = err
    }
  } finally {
    // Restore Jest mocks
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
    stderrWriteSpy.mockRestore()
    processExitSpy.mockRestore()
    process.stdout.isTTY = originalIsTTY.stdout
    process.stderr.isTTY = originalIsTTY.stderr
  }

  // If we have stderr but no error, create an error from stderr
  if (!error && stderr.trim()) {
    error = new Error(stderr.trim())
  }

  // Clean up the error message to remove EXIT_MOCK
  if (error?.message.includes('Error: EXIT_MOCK')) {
    error = new Error(error.message.replace('\nError: EXIT_MOCK', ''))
  }

  return {
    stdout,
    stderr,
    warnings,
    error,
  }
}

// arbitrary parsed config JSON that tests index into freely (conf.tracks[0]
// etc). `unknown` here buys nothing but a cast at every call site.
type Conf = Record<string, any>

export function readConf(ctx: { dir: string }, ...rest: string[]): Conf {
  return JSON.parse(
    readFileSync(path.join(ctx.dir, ...rest, 'config.json'), 'utf8'),
  )
}

export function readConfAlt(ctx: { dir: string }, ...rest: string[]): Conf {
  return JSON.parse(readFileSync(path.join(ctx.dir, ...rest), 'utf8'))
}

export function dataDir(str: string) {
  return path.join(__dirname, '..', 'test', 'data', str)
}

export function ctxDir(ctx: { dir: string }, str: string) {
  return path.join(ctx.dir, str)
}

interface MockFetchResponse {
  ok?: boolean
  status?: number
  statusText?: string
  headers?: Record<string, string>
  json?: unknown
  arrayBuffer?: ArrayBuffer
  body?: ReadableStream<Uint8Array>
}

// a FileHandle's readableWebStream does not close the handle, so the descriptor
// leaked until GC noticed it and printed a "Closing file descriptor N on garbage
// collection" warning at whatever point in the run that happened to be. A read
// stream closes itself at EOF.
export function openWebStream(filePath: string) {
  return Readable.toWeb(
    createReadStream(filePath),
  ) as ReadableStream<Uint8Array>
}

type MockFetchHandler =
  | MockFetchResponse
  | ((
      url: string,
    ) => MockFetchResponse | Promise<MockFetchResponse> | undefined)

async function resolveMock(handler: MockFetchHandler, urlStr: string) {
  const response =
    typeof handler === 'function' ? await handler(urlStr) : handler

  if (!response) {
    throw new Error(`Unexpected fetch to ${urlStr}`)
  }

  return {
    ok: response.ok ?? true,
    status: response.status ?? (response.ok === false ? 500 : 200),
    statusText: response.statusText ?? '',
    headers: new Headers(response.headers),
    json: async () => response.json,
    arrayBuffer: async () => response.arrayBuffer,
    text: async () => '',
    body: response.body ?? null,
  } as unknown as Response
}

export function mockFetch(mockOrHandler: MockFetchHandler) {
  const cliFetch = require('./cliFetch.ts').default as jest.MockedFunction<
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    typeof import('./cliFetch.ts').default
  >

  cliFetch.mockImplementation((url: string | URL) =>
    resolveMock(mockOrHandler, url.toString()),
  )

  return cliFetch
}

// Stubs the global fetch. Needed for code reached through
// @jbrowse/text-indexing-core, which deliberately uses global fetch rather than
// cliFetch so the same module works in the desktop indexing worker. Restore
// with jest.restoreAllMocks().
export function mockGlobalFetch(mockOrHandler: MockFetchHandler) {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(url => resolveMock(mockOrHandler, url.toString()))
}
