import fs from 'fs'
import os from 'os'
import path from 'path'

import { main as nativeMain } from './index'

const { mkdir, mkdtemp } = fs.promises

// increase test timeout for all tests
jest.setTimeout(20000)

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
export async function runNativeCommand(
  args: string | string[],
): Promise<{ stdout: string; stderr: string; error?: Error }> {
  const originalArgv = process.argv
  
  let stdout = ''
  let stderr = ''
  let error: Error | undefined
  let outputReceived = false

  // Mock console functions using Jest spies
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
    stdout += `${args.join(' ')}\n`
    outputReceived = true
  })
  
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
    stderr += `${args.join(' ')}\n`
    outputReceived = true
  })

  // Mock process.stdout.write
  const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    stdout += chunk.toString()
    outputReceived = true
    return true
  })

  // Mock process.stderr.write
  const stderrWriteSpy = jest.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    stderr += chunk.toString()
    outputReceived = true
    return true
  })

  // Mock process.exit
  const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
    if (code && code !== 0) {
      error = new Error(stderr.trim() || `Process exited with code ${code}`)
    }
    throw new Error('EXIT_MOCK')
  })

  try {
    // Parse arguments
    const argsArray = Array.isArray(args) ? args : [args]

    // Set up process.argv for native command
    process.argv = ['node', 'jbrowse-native', ...argsArray]

    // Run the native command
    await nativeMain()
    
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
    // Restore original functions
    process.argv = originalArgv
    
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
