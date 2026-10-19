// Screenshot the static-first-paint demo's live view as its own poster:
//
//   pnpm build && pnpm preview &
//   node scripts/capture-poster.mjs
//
// then copy the printed size into src/examples/StaticFirstPaint.tsx.
// #region shoot
import { fileURLToPath } from 'node:url'

import { launchBrowser, waitForJBrowseReady } from '@jbrowse/capture'

const url =
  process.argv[2] ?? 'http://localhost:4321/storybook/lgv/static-first-paint/'
const embed = '.demo astro-island > div'
const out = fileURLToPath(
  new URL('../public/static-first-paint.png', import.meta.url),
)

const browser = await launchBrowser()
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 })
  await page.goto(url)
  await waitForJBrowseReady(page)
  // the page takes its old poster down once the view has drawn
  await page.waitForFunction(
    s => !document.querySelector(`${s} img`),
    {},
    embed,
  )
  const element = await page.$(embed)
  await element.screenshot({ path: out })
  const { width, height } = await element.boundingBox()
  console.log(`wrote ${out}, ${width}x${height} CSS px`)
} finally {
  await browser.close()
}
// #endregion
