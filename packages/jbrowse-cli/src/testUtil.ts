/* eslint-disable import/no-extraneous-dependencies */
import { test as oclifTest } from '@oclif/test'
import del from 'del'
import fs from 'fs'
import os from 'os'
import path from 'path'

const fsPromises = fs.promises

// On macOS, os.tmpdir() is not a real path: https://github.com/nodejs/node/issues/11422
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

export const test = oclifTest
  .register('mockConsoleLog', mockConsoleLog)
  .register('mockConsoleWarn', mockConsoleWarn)
  .register('mockConsoleError', mockConsoleError)

export const setup = test
  .add('dir', async () => {
    const jbrowseTmpDir = path.join(tmpDir, 'jbrowse')
    await fsPromises.mkdir(jbrowseTmpDir, { recursive: true })
    return fsPromises.mkdtemp(path.join(jbrowseTmpDir, path.sep))
  })
  .finally(async ctx => {
    await del([`${ctx.dir}/**`, ctx.dir], { force: true })
  })
  .do(async ctx => {
    process.chdir(ctx.dir)
    await fsPromises.writeFile('manifest.json', '{"name":"JBrowse"}')
  })
