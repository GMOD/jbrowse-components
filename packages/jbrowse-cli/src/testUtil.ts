/* eslint-disable import/no-extraneous-dependencies */
import { test as oclifTest } from '@oclif/test'
import del from 'del'
import fs from 'fs'
import os from 'os'
import path from 'path'

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
  .add('dir', () => {
    const tmpDir = fs.realpathSync(os.tmpdir())
    const jbrowseTmpDir = path.join(tmpDir, 'jbrowse')
    fs.mkdirSync(jbrowseTmpDir, { recursive: true })
    return fs.mkdtempSync(path.join(jbrowseTmpDir, path.sep))
  })
  .finally(async ctx => {
    await del([`${ctx.dir}/**`, ctx.dir], { force: true })
    process.chdir(ctx.originalDir)
  })
  .do(ctx => {
    process.chdir(ctx.dir)
    fs.writeFileSync('manifest.json', '{"name":"JBrowse"}')
  })
