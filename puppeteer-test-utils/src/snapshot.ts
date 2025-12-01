import fs from 'fs'
import path from 'path'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import type { Page } from 'puppeteer'

const FAILURE_THRESHOLD = 0.01
const FAILURE_THRESHOLD_TYPE = 'percent'

export interface SnapshotOptions {
  snapshotsDir: string
  updateSnapshots?: boolean
}

export async function capturePageSnapshot(
  page: Page,
  name: string,
  options: SnapshotOptions,
) {
  const { snapshotsDir, updateSnapshots } = options

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
  const threshold =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    FAILURE_THRESHOLD_TYPE === 'percent'
      ? FAILURE_THRESHOLD
      : FAILURE_THRESHOLD / totalPixels

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
    message: `Snapshot differs by ${(diffPercent * 100).toFixed(2)}% (threshold: ${FAILURE_THRESHOLD * 100}%)`,
  }
}
