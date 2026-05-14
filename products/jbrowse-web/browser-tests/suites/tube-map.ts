import { PORT, appendGpuParam, delay, findByText } from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

async function navigateAndAddTubeMapView(page: Page) {
  const url = appendGpuParam(
    `http://localhost:${PORT}/?config=test_data/volvox/config.json&sessionName=Test%20Session`,
  )
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })

  await (await findByText(page, 'Add'))?.click()
  await delay(300)
  await (await findByText(page, 'Tube map view'))?.click()
  await delay(500)
}

async function loadExampleAndWait(page: Page) {
  await (await findByText(page, 'Load 15-node example', 10000))?.click()
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
}

const suite: TestSuite = {
  name: 'Tube Map View',
  tests: [
    {
      name: 'import form renders',
      fn: async page => {
        await navigateAndAddTubeMapView(page)
        await findByText(page, 'Load a GFA graph', 10000)
        await findByText(page, 'Track', 5000)
        await findByText(page, 'File / URL', 5000)
        await findByText(page, 'Load 15-node example', 5000)
      },
    },
    {
      name: 'load example GFA and render tube map',
      fn: async page => {
        await navigateAndAddTubeMapView(page)
        await loadExampleAndWait(page)

        await findByText(page, '15 nodes', 5000)
        await findByText(page, '2 tracks', 5000)

        // Example paths are named 'x' and 'y'
        await page.waitForFunction(
          () => {
            const spans = document.querySelectorAll('span')
            let foundX = false
            let foundY = false
            for (const d of spans) {
              if (d.textContent === 'x') {
                foundX = true
              }
              if (d.textContent === 'y') {
                foundY = true
              }
            }
            return foundX && foundY
          },
          { timeout: 5000 },
        )

        await delay(500)
        await snapshot(page, 'tube-map-example-loaded', 0.15)
      },
    },
    {
      name: 'node hover highlights',
      fn: async page => {
        await navigateAndAddTubeMapView(page)
        await loadExampleAndWait(page)
        await delay(500)

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
      name: 'legend hover highlights track',
      fn: async page => {
        await navigateAndAddTubeMapView(page)
        await loadExampleAndWait(page)
        await delay(300)

        const legendEntry = await page.evaluateHandle(() => {
          const spans = document.querySelectorAll('span')
          for (const s of spans) {
            if (s.textContent === 'x') {
              return s.parentElement
            }
          }
          return null
        })
        const legendElement = legendEntry.asElement()
        if (legendElement) {
          const box = await legendElement.boundingBox()
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
            await delay(300)
          }
        }

        await snapshot(page, 'tube-map-legend-hover', 0.15)
      },
    },
    {
      name: 'clear button returns to import form',
      fn: async page => {
        await navigateAndAddTubeMapView(page)
        await loadExampleAndWait(page)

        await (await findByText(page, 'Clear', 5000))?.click()

        await findByText(page, 'Load a GFA graph', 5000)
      },
    },
    {
      name: 'zoom to fit works',
      fn: async page => {
        await navigateAndAddTubeMapView(page)
        await loadExampleAndWait(page)
        await delay(300)

        await (await findByText(page, 'Zoom to fit', 5000))?.click()
        await delay(500)

        await snapshot(page, 'tube-map-zoom-to-fit', 0.15)
      },
    },
  ],
}

export default suite
