import { test as oclifTest } from '@oclif/test'
import rimraf from 'rimraf'
import fs from 'fs'
import os from 'os'
import path from 'path'

const { mkdir, mkdtemp, writeFile } = fs.promises

// increase test timeout for all tests
jest.setTimeout(20000)

// On macOS, os.tmpdir() is not a real path:
// https://github.com/nodejs/node/issues/11422
const tmpDir = fs.realpathSync(os.tmpdir())

/* eslint-disable no-console */
const mockConsoleLog = (opts?: { print?: boolean }) => ({
  run(ctx: { consoleLog: jest.Mock }) {
    const originalConsoleLog = console.log.bind(console)
    const consoleLogMock = jest.fn((...data: unknown[]) => {
      if (opts?.print) {
        originalConsoleLog(...data)
      }
    })
    console.log = consoleLogMock
    ctx.consoleLog = console.log as typeof consoleLogMock
  },
})
/* eslint-enable no-console */

const mockConsoleWarn = (opts?: { print?: boolean }) => ({
  run(ctx: { consoleWarn: jest.Mock }) {
    const originalConsoleWarn = console.warn.bind(console)
    const consoleWarnMock = jest.fn((...data: unknown[]) => {
      if (opts?.print) {
        originalConsoleWarn(...data)
      }
    })
    console.warn = consoleWarnMock
    ctx.consoleWarn = console.warn as typeof consoleWarnMock
  },
})

const mockConsoleError = (opts?: { print?: boolean }) => ({
  run(ctx: { consoleError: jest.Mock }) {
    const originalConsoleError = console.error.bind(console)
    const consoleErrorMock = jest.fn((...data: unknown[]) => {
      if (opts?.print) {
        originalConsoleError(...data)
      }
    })
    console.error = consoleErrorMock
    ctx.consoleError = console.error as typeof consoleErrorMock
  },
})

const mockStdoutWrite = (opts?: { print?: boolean }) => ({
  run(ctx: { stdoutWrite: jest.Mock }) {
    const stdoutWriteMock = jest.fn((data: Buffer | string) => {
      if (opts?.print) {
        // eslint-disable-next-line no-console
        console.log(data)
      }
      return true
    })
    process.stdout.write = stdoutWriteMock
    ctx.stdoutWrite = process.stdout.write as typeof stdoutWriteMock
  },
})

export const test = oclifTest
  .register('mockConsoleLog', mockConsoleLog)
  .register('mockConsoleWarn', mockConsoleWarn)
  .register('mockConsoleError', mockConsoleError)
  .register('mockStdoutWrite', mockStdoutWrite)

export const setup = test
  .mockStdoutWrite()
  .add('originalDir', () => process.cwd())
  .add('dir', async () => {
    const jbrowseTmpDir = path.join(tmpDir, 'jbrowse')
    await mkdir(jbrowseTmpDir, { recursive: true })
    return mkdtemp(path.join(jbrowseTmpDir, path.sep))
  })
  .finally(async ctx => {
    rimraf.sync(`${ctx.dir}`)
    process.chdir(ctx.originalDir)
  })
  .do(async ctx => {
    process.chdir(ctx.dir)
    await writeFile('manifest.json', '{"name":"JBrowse"}')
  })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// source https://stackoverflow.com/a/64255382/2129219
export async function copyDir(src: string, dest: string) {
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = await fs.promises.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    entry.isDirectory()
      ? await copyDir(srcPath, destPath)
      : await fs.promises.copyFile(srcPath, destPath)
  }
}
