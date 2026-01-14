/// <reference types="wdio-electron-service" />
import type { Options } from '@wdio/types'

const appBinaryPath =
  process.platform === 'darwin'
    ? 'dist/mac/JBrowse 2.app/Contents/MacOS/JBrowse 2'
    : process.platform === 'win32'
      ? 'dist/win-unpacked/JBrowse 2.exe'
      : 'dist/linux-unpacked/jbrowse-desktop'

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./test/specs/**/*.ts'],
  maxInstances: 1,

  capabilities: [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': {
        appBinaryPath,
      },
    },
  ],

  logLevel: 'error',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ['electron'],
  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  afterTest: async function (_test, _context, { passed }) {
    if (!passed) {
      const { browser } = await import('@wdio/globals')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      await browser.saveScreenshot(`./test/screenshots/failure-${timestamp}.png`)
    }
  },
}
