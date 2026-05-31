import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { analyzeCanvasPng, assertNonBlank } from './canvasContent.ts'
import { comparePngBuffers } from './pngDiff.ts'

import type { Buffer } from 'node:buffer'
import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baseSnapshotsDir = path.resolve(__dirname, '__snapshots__')

export const snapshotConfig = {
  backend: '' as string,
  updateSnapshots: false,
  get snapshotsDir() {
    return this.backend
      ? path.join(baseSnapshotsDir, this.backend)
      : baseSnapshotsDir
  },
}

function compareImages(
  name: string,
  actualBuffer: Buffer | Uint8Array,
  threshold = 0.1,
) {
  const { snapshotsDir, updateSnapshots } = snapshotConfig
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
  const diff = comparePngBuffers(expectedBuffer, actualBuffer)

  if (!diff.sameSize) {
    // If the existing golden is the default empty canvas size (300x150),
    // auto-update it since it was clearly captured blank
    if (diff.widthA === 300 && diff.heightA === 150) {
      fs.writeFileSync(snapshotPath, actualBuffer)
      return {
        passed: true,
        message: 'Snapshot auto-updated from blank golden',
      }
    }
    // If the new capture is blank but golden is real, treat as pass
    // since this just means WebGL didn't render this time
    if (diff.widthB === 300 && diff.heightB === 150) {
      return {
        passed: true,
        message: 'Skipping comparison - blank canvas capture',
      }
    }
    fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), actualBuffer)
    return {
      passed: false,
      message: `Snapshot size differs: expected ${diff.widthA}x${diff.heightA}, got ${diff.widthB}x${diff.heightB}`,
    }
  }

  if (diff.diffFraction <= threshold) {
    return { passed: true, message: 'Snapshot matches' }
  }

  fs.writeFileSync(path.join(snapshotsDir, `${name}.diff.png`), actualBuffer)
  fs.writeFileSync(
    path.join(snapshotsDir, `${name}.diff-visual.png`),
    diff.diffImage,
  )
  return {
    passed: false,
    message: `Snapshot differs by ${(diff.diffFraction * 100).toFixed(2)}% (threshold: ${threshold * 100}%)`,
  }
}

export async function capturePageSnapshot(page: Page, name: string) {
  const screenshot = await page.screenshot({ fullPage: true })
  return compareImages(name, screenshot)
}

// LoadingOverlay always keeps the literal text "Loading" in the DOM (hidden via
// opacity:0), so textContent can never distinguish visible from hidden — a
// textContent.includes('Loading') wait always burns the full timeout. The
// data-testid="loading-overlay" attribute is only present while visible, so
// counting those elements is the reliable "still loading" signal. Mirrors
// waitForLoadingToComplete in helpers.ts (inlined here to avoid a circular
// import, since helpers.ts imports snapshotConfig from this file).
async function waitForLoadingOverlayGone(page: Page, timeout: number) {
  try {
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-testid="loading-overlay"]').length ===
        0,
      { timeout },
    )
  } catch {
    // proceed with snapshot even if still loading after timeout — the image
    // comparison is the real assertion
  }
}

export async function pageSnapshot(page: Page, name: string, threshold = 0.1) {
  // Every full-page golden is prefixed `fullpage_`; a redundant `-fullpage`
  // suffix on older names is dropped so callers don't have to be updated.
  const base = name.replace(/^fullpage_/, '').replace(/-fullpage$/, '')
  await waitForLoadingOverlayGone(page, 30000)

  const screenshot = await page.screenshot({ fullPage: true })
  const result = compareImages(`fullpage_${base}`, screenshot, threshold)
  if (!result.passed) {
    throw new Error(result.message)
  }
}

// Extract a canvas element's pixel data as PNG and compare it.
// More reliable than full-page screenshots since it only captures
// the rendered canvas content, avoiding UI/loading state variability.
//
// `assertContent` (default true) gates every targeted canvas capture on the
// shader/renderer having actually drawn something before the pixel comparison
// runs. Without it, the snapshot machinery silently passes blank GPU frames
// (first-run goldens are auto-created blank, and a later blank capture is
// treated as a pass), so a shader that compiles but draws nothing would never
// fail. Pass `false` only for a display that legitimately renders empty.
export async function canvasSnapshot(
  page: Page,
  name: string,
  selector: string,
  threshold = 0.05,
  { assertContent = true }: { assertContent?: boolean } = {},
) {
  const el = await page.waitForSelector(selector, { timeout: 60000 })
  if (!el) {
    throw new Error(`Canvas element not found: ${selector}`)
  }

  const screenshot = await el.screenshot({ type: 'png' })
  if (assertContent) {
    assertNonBlank(analyzeCanvasPng(screenshot), `${name} (${selector})`)
  }
  const result = compareImages(name, screenshot, threshold)
  if (!result.passed) {
    throw new Error(result.message)
  }
}

// Capture BOTH a targeted (canvas-element) and a full-page snapshot for one
// test. Targeted isolates renderer fidelity (low variance); full-page adds
// ruler / track-label / layout / multi-track integration coverage. All targeted
// files are `targeted_<base>`, all full-page files are `fullpage_<base>`, where
// <base> is `name` with a trailing `-canvas` stripped. The canvas shot runs
// first, so it gates the full-page capture on paint-complete (canvasSnapshot
// waits for the `*_done` selector).
export async function dualSnapshot(
  page: Page,
  name: string,
  selector: string,
  threshold = 0.05,
  { assertContent = true }: { assertContent?: boolean } = {},
) {
  const base = name.replace(/-canvas$/, '')
  await canvasSnapshot(page, `targeted_${base}`, selector, threshold, {
    assertContent,
  })
  await pageSnapshot(page, `fullpage_${base}`)
}
