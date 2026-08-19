/* eslint-disable no-console */
// What canvasSelfReport says about each canvas of a GPU display, on a page that
// is unambiguously rendering. The WebGL canvas reads back blank either way (no
// preserveDrawingBuffer), so its note is the one that must not claim to have
// found the render side.
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { startServerOnFreePort } from './server.ts'
import { canvasSelfReport } from './snapshot.ts'

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:30,222..33,669',
      tracks: ['volvox_ins.paf'],
    },
  ],
}

const swiftshader = !process.argv.includes('--real-gpu')
const { server, port } = await startServerOnFreePort(3210)
const browser = await launch({
  headless: true,
  args: [
    ...BASE_CHROME_ARGS,
    ...(swiftshader
      ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
      : ['--use-gl=angle']),
  ],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 800 })
const url =
  `http://localhost:${port}/?config=test_data/volvox/config.json` +
  `&session=spec-${encodeURIComponent(JSON.stringify(spec))}&renderer=webgl`
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
await page.waitForSelector('[data-display-drawn="true"] canvas', {
  timeout: 60000,
})
await new Promise(r => setTimeout(r, 3000))

// tag each canvas so the selector can address it individually
const kinds = await page.evaluate(() => {
  const out: string[] = []
  document.querySelectorAll('canvas').forEach((c, i) => {
    c.dataset.probe = String(i)
    let isGl = false
    try {
      isGl = !!c.getContext('webgl2')
    } catch {
      isGl = false
    }
    out.push(isGl ? 'webgl2' : '2d')
  })
  return out
})

console.log(swiftshader ? '=== SWIFTSHADER' : '=== REAL GPU')
for (const [i, kind] of kinds.entries()) {
  const { note } = await canvasSelfReport(page, `canvas[data-probe="${i}"]`)
  console.log(`  canvas ${i} (${kind}):${note}`)
}
await browser.close()
server.close()
