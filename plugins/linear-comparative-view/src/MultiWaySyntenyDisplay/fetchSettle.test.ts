import { SimpleFeature } from '@jbrowse/core/util'
import { when } from 'mobx'

import { createDisplayWithSession } from './testEnv.ts'

const MATE = 'volvox_random'

const orthologs = [0, 1, 2, 3].map(
  i =>
    new SimpleFeature({
      uniqueId: `g${i}`,
      name: `g${i}`,
      refName: 'ctgA',
      start: 50 + 100 * i,
      end: 110 + 100 * i,
      strand: 1,
      mate: {
        assemblyName: MATE,
        refName: 'ctgA',
        start: 1600 + 100 * i,
        end: 1660 + 100 * i,
      },
    }),
)

const ANCHOR_DEBOUNCE_MS = 1000

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

async function idleDisplay() {
  const asked: number[] = []
  const { display } = createDisplayWithSession({
    trackAssemblyNames: ['volvox', MATE],
    rpc: async name => {
      if (name === 'MultiWayGetFeatures') {
        asked.push(performance.now())
      }
      return orthologs
    },
  })
  await when(() => display.features !== undefined, { timeout: 5000 })
  await wait(ANCHOR_DEBOUNCE_MS + 100)
  return { display, asked }
}

async function until(done: () => boolean) {
  const deadline = Date.now() + 5000
  while (!done() && Date.now() < deadline) {
    await wait(10)
  }
  expect(done()).toBe(true)
}

test('a view that keeps moving fetches nothing, and fetches once it stops without waiting out the debounce', async () => {
  const { display, asked } = await idleDisplay()
  const view = display.lgv
  const before = asked.length
  for (let step = 0; step < 6; step++) {
    view.zoomTo(view.bpPerPx * 0.8)
    await wait(50)
  }
  expect(asked).toHaveLength(before)
  const stopped = performance.now()
  await until(() => asked.length > before)
  expect(asked[before]! - stopped).toBeLessThan(ANCHOR_DEBOUNCE_MS / 2)
})

test('a jump fetches at once', async () => {
  const { display, asked } = await idleDisplay()
  const view = display.lgv
  const before = asked.length
  const jumped = performance.now()
  view.moveTo({ index: 0, offset: 100 }, { index: 0, offset: 400 })
  await until(() => asked.length > before)
  expect(asked[before]! - jumped).toBeLessThan(100)
})

test('a second jump inside the debounce still waits', async () => {
  const { display, asked } = await idleDisplay()
  const view = display.lgv
  const first = asked.length
  view.moveTo({ index: 0, offset: 100 }, { index: 0, offset: 400 })
  await until(() => asked.length > first)
  await wait(100)
  const before = asked.length
  view.moveTo({ index: 0, offset: 500 }, { index: 0, offset: 800 })
  await wait(ANCHOR_DEBOUNCE_MS / 4)
  expect(asked).toHaveLength(before)
  await until(() => asked.length > before)
})
