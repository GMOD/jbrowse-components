import {
  PORT,
  appendGpuParam,
  delay,
  findByText,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

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

        // Wait for the layout + render to complete
        await page.waitForFunction(
          () => {
            const body = document.body.textContent || ''
            const hasNodes = body.includes('nodes')
            const isLoading =
              body.includes('Computing layout') ||
              body.includes('Downloading')
            return hasNodes && !isLoading
          },
          { timeout: 60000, polling: 500 },
        )

        // Give renderer time to draw
        await delay(2000)

        await canvasSnapshot(
          page,
          'graph-genome-canvas',
          'canvas',
          0.15,
        )
      },
    },
  ],
}

export default suite
