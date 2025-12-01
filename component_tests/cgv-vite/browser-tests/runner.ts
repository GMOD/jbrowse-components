/* eslint-disable no-console */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  createTestRunner,
  parseArgs,
  findByTestId,
  type TestSuite,
} from 'puppeteer-test-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const { headed, slowMo } = parseArgs(args)

const buildPath = path.resolve(__dirname, '../dist')
const PORT = 5000

const testSuites: TestSuite[] = [
  {
    name: 'CGV Component',
    tests: [
      {
        name: 'track loads',
        fn: async page => {
          await page.goto(`http://localhost:${PORT}/`, {
            waitUntil: 'networkidle0',
            timeout: 60000,
          })
          await findByTestId(page, 'chord-adp-1843523680-A-0', 30000)
        },
      },
    ],
  },
]

if (!fs.existsSync(buildPath)) {
  console.error('Error: Build directory not found. Run `yarn build` first.')
  process.exit(1)
}

createTestRunner(
  {
    server: { port: PORT, publicPath: buildPath },
    headed,
    slowMo,
  },
  testSuites,
)
