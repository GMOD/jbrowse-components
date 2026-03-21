import {
  PORT,
  appendGpuParam,
  delay,
  findByText,
} from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

async function navigateAndAddGraphView(page: import('puppeteer').Page) {
  const url = appendGpuParam(
    `http://localhost:${PORT}/?config=test_data/volvox/config.json&sessionName=Test%20Session`,
  )
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })

  // Add > Graph genome view
  await (await findByText(page, 'Add'))?.click()
  await delay(300)
  await (await findByText(page, 'Graph genome view'))?.click()
  await delay(500)
}

const suite: TestSuite = {
  name: 'Graph Genome View',
  tests: [
    {
      name: 'import form renders',
      fn: async page => {
        await navigateAndAddGraphView(page)
        await findByText(page, 'Load a GFA graph', 10000)
        await findByText(page, 'From file', 5000)
        await findByText(page, 'From URL', 5000)
        await findByText(page, 'Load example graph', 5000)
      },
    },
    {
      name: 'load example GFA and render graph',
      fn: async page => {
        await navigateAndAddGraphView(page)

        const exampleBtn = await findByText(page, 'Load example graph', 10000)
        await exampleBtn?.click()

        // Wait for layout to complete — loading overlay should disappear
        await page.waitForFunction(
          () => {
            const canvases = document.querySelectorAll('canvas')
            for (const c of canvases) {
              if (c.width > 0 && c.height > 0) {
                return true
              }
            }
            return false
          },
          { timeout: 30000, polling: 500 },
        )

        // Verify toolbar elements appeared
        await findByText(page, 'nodes', 5000)

        await snapshot(page, 'graph-genome-example', 0.15)
      },
    },
  ],
}

export default suite
