import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const snapshotsDir = path.resolve(__dirname, '__snapshots__')

let updateSnapshots = false

export function setUpdateSnapshots(val: boolean) {
  updateSnapshots = val
}

export async function capturePageSnapshot(page: Page, name: string) {
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true })
  }

  const screenshot = await page.screenshot({ fullPage: true })
  const snapshotPath = path.join(snapshotsDir, `${name}.png`)

  if (updateSnapshots || !fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, screenshot)
    return {
      passed: true,
      message: updateSnapshots ? 'Snapshot updated' : 'Snapshot created',
    }
  }

  const expectedBuffer = fs.readFileSync(snapshotPath)
  const expectedImg = PNG.sync.read(expectedBuffer)
  // @ts-expect-error Uint8Array works at runtime
  const actualImg = PNG.sync.read(screenshot)

  if (
    expectedImg.width !== actualImg.width ||
    expectedImg.height !== actualImg.height
  ) {
    fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), screenshot)
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
  const threshold = 0.05

  if (diffPercent <= threshold) {
    return { passed: true, message: 'Snapshot matches' }
  }

  fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), screenshot)
  fs.writeFileSync(
    path.join(snapshotsDir, `${name}.diff-visual.png`),
    PNG.sync.write(diffImg),
  )
  return {
    passed: false,
    message: `Snapshot differs by ${(diffPercent * 100).toFixed(2)}% (threshold: ${threshold * 100}%)`,
  }
}

export async function snapshot(page: Page, name: string) {
  // Wait for any "Loading" text to clear from track rendering containers
  // before capturing the snapshot to avoid flakiness
  try {
    await page.waitForFunction(
      () => {
        const containers = document.querySelectorAll(
          '[data-testid^="trackRenderingContainer"]',
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

  const result = await capturePageSnapshot(page, name)
  if (!result.passed) {
    throw new Error(result.message)
  }
}
