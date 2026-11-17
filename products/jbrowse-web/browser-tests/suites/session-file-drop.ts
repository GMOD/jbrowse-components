// Files dropped from the OS onto an open session: a bgzipped BED and its .tbi,
// dropped together on a view, pair into one indexed track whose browser-file
// locations resolve in the worker. Jest covers the routing; only a real browser
// has a worker realm and a real DataTransfer.
import {
  findDisplayPainted,
  findByText,
  navigateWithSessionSpec,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const FILES = ['volvox-bed12.bed.gz', 'volvox-bed12.bed.gz.tbi']

function dropOnView(page: Page) {
  return page.evaluate(async files => {
    const transfer = new DataTransfer()
    for (const name of files) {
      const bytes = await (
        await fetch(`/test_data/volvox/${name}`)
      ).arrayBuffer()
      transfer.items.add(new File([bytes], name))
    }
    const target = document.querySelector('[data-view-id]')
    if (!target) {
      throw new Error('no view on the page to drop onto')
    }
    for (const type of ['dragenter', 'dragover', 'drop']) {
      target.dispatchEvent(
        new DragEvent(type, {
          dataTransfer: transfer,
          bubbles: true,
          cancelable: true,
        }),
      )
    }
  }, FILES)
}

function readDroppedTrack(page: Page) {
  return page.evaluate(() => {
    const view = (window as any).JBrowseSession.views[0]
    const track = view.tracks.find((t: any) =>
      t.configuration.trackId.includes('volvox-bed12'),
    )
    const adapter = track?.configuration.adapter
    return track
      ? {
          adapterType: adapter.type,
          hasIndex: !!adapter.index?.location?.blobId,
          error: track.displays[0]?.error
            ? String(track.displays[0].error)
            : undefined,
        }
      : undefined
  })
}

const suite: TestSuite = {
  name: 'SessionFileDrop',
  tests: [
    {
      name: 'a dropped .bed.gz and its .tbi open as one indexed track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
            },
          ],
        })
        await page.waitForSelector('[data-view-id]', { timeout: 30000 })
        await dropOnView(page)
        const add = await findByText(page, 'Add 1 track', 30000)
        await add.click()
        await findDisplayPainted(page, 'feature-display', 60000)

        const track = await readDroppedTrack(page)
        if (!track) {
          throw new Error('the dropped files added no track to the view')
        }
        if (track.adapterType !== 'BedTabixAdapter' || !track.hasIndex) {
          throw new Error(
            `expected an indexed BedTabixAdapter, got ${JSON.stringify(track)}`,
          )
        }
        if (track.error) {
          throw new Error(`the dropped track failed to load: ${track.error}`)
        }
      },
    },
  ],
}

export default suite
