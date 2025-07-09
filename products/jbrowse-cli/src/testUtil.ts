import fs from 'fs'
import os from 'os'
import path from 'path'

import { runCommand } from '@oclif/test'
import { main as nativeMain } from './index-native'

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
export async function setup(str: string | string[]) {
  return runCommand(str)
}

// Native command runner for testing
export async function runNativeCommand(args: string | string[]): Promise<{ stdout?: string; stderr?: string; error?: Error }> {
  const originalArgv = process.argv
  const originalStdout = process.stdout.write
  const originalStderr = process.stderr.write
  const originalExit = process.exit
  const originalConsoleError = console.error
  const originalConsoleLog = console.log
  
  let stdout = ''
  let stderr = ''
  let error: Error | undefined
  
  try {
    // Mock stdout and stderr
    process.stdout.write = (chunk: any) => {
      stdout += chunk.toString()
      return true
    }
    
    process.stderr.write = (chunk: any) => {
      stderr += chunk.toString()
      return true
    }
    
    // Mock console.error to capture error messages
    console.error = (...args: any[]) => {
      stderr += args.join(' ') + '\n'
    }
    
    // Mock console.log to capture log messages
    console.log = (...args: any[]) => {
      stdout += args.join(' ') + '\n'
    }
    
    // Mock process.exit to capture exit codes
    process.exit = ((code?: number) => {
      if (code && code !== 0) {
        error = new Error(stderr.trim() || `Process exited with code ${code}`)
      }
      throw new Error('EXIT_MOCK')
    }) as any
    
    // Parse arguments
    const argsArray = Array.isArray(args) ? args : [args]
    
    // Set up process.argv for native command
    process.argv = [
      'node',
      'jbrowse-native',
      ...argsArray
    ]
    
    // Run the native command
    await nativeMain()
    
  } catch (err) {
    if (err instanceof Error && err.message !== 'EXIT_MOCK') {
      error = err
    }
  } finally {
    // Restore original functions
    process.argv = originalArgv
    process.stdout.write = originalStdout
    process.stderr.write = originalStderr
    process.exit = originalExit
    console.error = originalConsoleError
    console.log = originalConsoleLog
  }
  
  // If we have stderr but no error, create an error from stderr
  if (!error && stderr.trim()) {
    error = new Error(stderr.trim())
  }
  
  // Clean up the error message to remove EXIT_MOCK
  if (error && error.message.includes('Error: EXIT_MOCK')) {
    error = new Error(error.message.replace('\nError: EXIT_MOCK', ''))
  }
  
  return { stdout, stderr, error }
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
