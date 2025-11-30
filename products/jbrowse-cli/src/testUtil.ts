import fs from 'fs'
import os from 'os'
import path from 'path'

import { vi } from 'vitest'

import { main as nativeMain } from './index'

const { mkdir, mkdtemp } = fs.promises

// On macOS, os.tmpdir() is not a real path:
// https://github.com/nodejs/node/issues/11422
const tmpDir = fs.realpathSync(os.tmpdir())

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
      fs.rmSync(dir, { recursive: true, force: true })
    }
    process.chdir(originalDir)
  }
}

// Native command runner for testing
export async function runCommand(
  args: string | string[],
): Promise<{ stdout: string; stderr: string; error?: Error }> {
  let stdout = ''
  let stderr = ''
  let error: Error | undefined
  let outputReceived = false

  // Mock console functions using Jest spies
  const consoleLogSpy = vi
    .spyOn(console, 'log')
    .mockImplementation((...args: any[]) => {
      stdout += `${args.join(' ')}\n`
      outputReceived = true
    })

  const consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((...args: any[]) => {
      stderr += `${args.join(' ')}\n`
      outputReceived = true
    })

  // Mock process.stdout.write
  const stdoutWriteSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: any) => {
      stdout += chunk.toString()
      outputReceived = true
      return true
    })

  // Mock process.stderr.write
  const stderrWriteSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: any) => {
      stderr += chunk.toString()
      outputReceived = true
      return true
    })

  // Mock process.exit
  const processExitSpy = vi
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

    // Wait for any pending asynchronous console output
    // This handles cases where commands start servers or other async operations
    // that log output after the main command completes
    await new Promise(resolve => {
      if (outputReceived) {
        // If we received output, wait a bit for any additional async output
        setTimeout(resolve, 50)
      } else {
        // If no output yet, wait longer and check periodically
        let attempts = 0
        const checkForOutput = () => {
          if (outputReceived || attempts > 10) {
            resolve(undefined)
          } else {
            attempts++
            setTimeout(checkForOutput, 10)
          }
        }
        checkForOutput()
      }
    })
  } catch (err) {
    if (err instanceof Error && err.message !== 'EXIT_MOCK') {
      error = err
    }
  } finally {
    // Restore Jest mocks
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
    stderrWriteSpy.mockRestore()
    processExitSpy.mockRestore()
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
    error,
  }
}

type Conf = Record<string, any>

export function readConf(ctx: { dir: string }, ...rest: string[]): Conf {
  return JSON.parse(
    fs.readFileSync(path.join(ctx.dir, ...rest, 'config.json'), 'utf8'),
  )
}

export function readConfAlt(ctx: { dir: string }, ...rest: string[]): Conf {
  return JSON.parse(fs.readFileSync(path.join(ctx.dir, ...rest), 'utf8'))
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
  body?: NodeJS.ReadableStream
}

export function mockFetch(
  mockOrHandler:
    | MockFetchResponse
    | ((url: string) => MockFetchResponse | undefined),
) {
  const fetchWithProxy = require('./fetchWithProxy')
    .default as jest.MockedFunction<
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    typeof import('./fetchWithProxy').default
  >

  fetchWithProxy.mockImplementation(async (url: RequestInfo) => {
    const urlStr = url.toString()
    const response =
      typeof mockOrHandler === 'function'
        ? mockOrHandler(urlStr)
        : mockOrHandler

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
      body: response.body,
    } as unknown as Response
  })

  return fetchWithProxy
}
