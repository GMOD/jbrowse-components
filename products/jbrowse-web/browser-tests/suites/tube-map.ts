import { PORT, appendGpuParam, delay, findByText } from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

async function navigateAndAddTubeMapView(page: Page) {
  const url = appendGpuParam(
    `http://localhost:${PORT}/?config=test_data/volvox/config.json&sessionName=Test%20Session`,
  )
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })

  // Add > Tube map view
  await (await findByText(page, 'Add'))?.click()
  await delay(300)
  await (await findByText(page, 'Tube map view'))?.click()
  await delay(500)
}

const suite: TestSuite = {
  name: 'Tube Map View',
  tests: [
    {
      name: 'import form renders',
      fn: async page => {
        await navigateAndAddTubeMapView(page)
        await findByText(page, 'Load a GFA graph', 10000)
        await findByText(page, 'From file', 5000)
        await findByText(page, 'From URL', 5000)
        await findByText(
          page,
          'Load example (tiny pangenome, 15 nodes, 2 haplotypes)',
          5000,
        )
      },
    },
    {
      name: 'load example GFA and render tube map',
      fn: async page => {
        await navigateAndAddTubeMapView(page)

        const exampleBtn = await findByText(
          page,
          'Load example (tiny pangenome, 15 nodes, 2 haplotypes)',
          10000,
        )
        await exampleBtn?.click()

        // Wait for layout to complete and SVG to appear
        await page.waitForSelector('svg', { timeout: 10000 })

        // Verify toolbar stats rendered
        await findByText(page, '15 nodes', 10000)
        await findByText(page, '2 tracks', 10000)

        // Wait for SVG content to render (nodes + paths)
        await page.waitForFunction(
          () => {
            const svgs = document.querySelectorAll('svg')
            for (const svg of svgs) {
              // look for the tube map SVG (has rect elements for nodes)
              if (svg.querySelectorAll('rect').length >= 15) {
                return true
              }
            }
            return false
          },
          { timeout: 10000, polling: 200 },
        )

        await delay(500)
        await snapshot(page, 'tube-map-example-loaded', 0.15)
      },
    },
    {
      name: 'node hover highlights',
      fn: async page => {
        await navigateAndAddTubeMapView(page)

        const exampleBtn = await findByText(
          page,
          'Load example (tiny pangenome, 15 nodes, 2 haplotypes)',
          10000,
        )
        await exampleBtn?.click()

        // Wait for nodes to render
        await page.waitForFunction(
          () => {
            const svgs = document.querySelectorAll('svg')
            for (const svg of svgs) {
              if (svg.querySelectorAll('rect').length >= 15) {
                return true
              }
            }
            return false
          },
          { timeout: 10000, polling: 200 },
        )

        await delay(500)

        // Find a node rect and hover over it
        const rects = await page.$$('svg rect')
        if (rects.length > 0) {
          const box = await rects[0]!.boundingBox()
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
            await delay(300)
          }
        }

        await snapshot(page, 'tube-map-node-hover', 0.15)
      },
    },
    {
      name: 'zoom to fit works',
      fn: async page => {
        await navigateAndAddTubeMapView(page)

        const exampleBtn = await findByText(
          page,
          'Load example (tiny pangenome, 15 nodes, 2 haplotypes)',
          10000,
        )
        await exampleBtn?.click()

        await page.waitForFunction(
          () => {
            const svgs = document.querySelectorAll('svg')
            for (const svg of svgs) {
              if (svg.querySelectorAll('rect').length >= 15) {
                return true
              }
            }
            return false
          },
          { timeout: 10000, polling: 200 },
        )

        await delay(300)

        // Click zoom to fit
        const zoomBtn = await findByText(page, 'Zoom to fit', 5000)
        await zoomBtn?.click()
        await delay(500)

        await snapshot(page, 'tube-map-zoom-to-fit', 0.15)
      },
    },
  ],
}

export default suite
