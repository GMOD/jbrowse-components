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
    name: 'LGV Component',
    tests: [
      {
        name: 'track loads',
        fn: async page => {
          await page.goto(`http://localhost:${PORT}/`, {
            waitUntil: 'networkidle0',
            timeout: 60000,
          })
          await findByTestId(page, 'Blockset-pileup', 30000)
          await findByTestId(
            page,
            'prerendered_canvas_{volvox}ctgA:1..81-0_done',
            30000,
          )
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
