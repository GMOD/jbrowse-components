import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import type { ElementHandle, Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const snapshotsDir = path.resolve(__dirname, '__snapshots__')

let updateSnapshots = false

export function setUpdateSnapshots(val: boolean) {
  updateSnapshots = val
}

function compareImages(
  name: string,
  actualBuffer: Buffer | Uint8Array,
  threshold = 0.1,
) {
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true })
  }
  const snapshotPath = path.join(snapshotsDir, `${name}.png`)

  if (updateSnapshots || !fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, actualBuffer)
    return {
      passed: true,
      message: updateSnapshots ? 'Snapshot updated' : 'Snapshot created',
    }
  }

  const expectedBuffer = fs.readFileSync(snapshotPath)
  const expectedImg = PNG.sync.read(expectedBuffer)
  // @ts-expect-error Uint8Array works at runtime
  const actualImg = PNG.sync.read(actualBuffer)

  if (
    expectedImg.width !== actualImg.width ||
    expectedImg.height !== actualImg.height
  ) {
    fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), actualBuffer)
    return {
      passed: false,
      message: `Snapshot size differs: expected ${expectedImg.width}x${expectedImg.height}, got ${actualImg.width}x${actualImg.height}`,
    }
  }

  const { width, height } = expectedImg
  const diffImg = new PNG({ width, height })

  const numDiffPixels = pixelmatch(
    expectedImg.data,
    actualImg.data,
    diffImg.data,
    width,
    height,
    { threshold: 0.1 },
  )

  const totalPixels = width * height
  const diffPercent = numDiffPixels / totalPixels

  if (diffPercent <= threshold) {
    return { passed: true, message: 'Snapshot matches' }
  }

  fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), actualBuffer)
  fs.writeFileSync(
    path.join(snapshotsDir, `${name}.diff-visual.png`),
    PNG.sync.write(diffImg),
  )
  return {
    passed: false,
    message: `Snapshot differs by ${(diffPercent * 100).toFixed(2)}% (threshold: ${threshold * 100}%)`,
  }
}

export async function capturePageSnapshot(page: Page, name: string) {
  const screenshot = await page.screenshot({ fullPage: true })
  return compareImages(name, screenshot)
}

export async function snapshot(page: Page, name: string, threshold = 0.1) {
  // Wait for any "Loading" text to clear from view containers
  // before capturing the snapshot to avoid flakiness
  try {
    await page.waitForFunction(
      () => {
        const containers = document.querySelectorAll(
          '[data-testid^="view-container-"]',
        )
        for (const c of containers) {
          if (c.textContent?.includes('Loading')) {
            return false
          }
        }
        return true
      },
      { timeout: 10000 },
    )
  } catch {
    // proceed with snapshot even if loading text is still present
  }

  const screenshot = await page.screenshot({ fullPage: true })
  const result = compareImages(name, screenshot, threshold)
  if (!result.passed) {
    throw new Error(result.message)
  }
}

// Extract a canvas element's pixel data as PNG and compare it.
// More reliable than full-page screenshots since it only captures
// the rendered canvas content, avoiding UI/loading state variability.
export async function canvasSnapshot(
  page: Page,
  name: string,
  selector: string,
  threshold = 0.05,
) {
  const el = (await page.waitForSelector(selector, {
    timeout: 60000,
  })) as ElementHandle<HTMLCanvasElement> | null
  if (!el) {
    throw new Error(`Canvas element not found: ${selector}`)
  }

  const pngBase64 = await page.evaluate(canvas => {
    return canvas.toDataURL('image/png').split(',')[1]!
  }, el)

  const pngBuffer = Buffer.from(pngBase64, 'base64')
  const result = compareImages(name, pngBuffer, threshold)
  if (!result.passed) {
    throw new Error(result.message)
  }
}
