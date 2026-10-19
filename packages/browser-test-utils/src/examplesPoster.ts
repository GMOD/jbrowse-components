import { launchBrowser, waitForJBrowseReady } from '@jbrowse/capture'

import { serveExamplesSite } from './examplesSiteServer.ts'

/**
 * Screenshot the live view on `url` once it has drawn, for a page that shows
 * that picture while the view loads. `embed` selects the element holding the
 * view, and `out` is the PNG to write. Returns the element's size in CSS px,
 * which the page needs for its `<img>`.
 */
export async function shootPoster(
  url: string,
  embed: string,
  out: `${string}.png`,
) {
  // #region shoot
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
    if (!element) {
      throw new Error(`no ${embed} on ${url}`)
    }
    await element.screenshot({ path: out })
    const box = await element.boundingBox()
    return { width: Math.round(box!.width), height: Math.round(box!.height) }
  } finally {
    await browser.close()
  }
  // #endregion
}

/** `shootPoster` against an examples-site's built page for `slug`. */
export async function captureExamplePoster({
  distDir,
  base,
  slug,
  out,
}: {
  distDir: string
  base: string
  slug: string
  out: `${string}.png`
}) {
  const site = await serveExamplesSite(distDir, base)
  try {
    return await shootPoster(
      site.url(slug),
      `#${slug} .demo astro-island > div`,
      out,
    )
  } finally {
    await site.close()
  }
}
