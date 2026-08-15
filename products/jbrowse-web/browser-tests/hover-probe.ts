/* eslint-disable no-console */
// One-off probe (not a suite): capture a synteny ribbon un-hovered and hovered
// at a given display alpha, so the hover cue can be looked at rather than
// reasoned about. f96108bad9 changed fillShade's hover branch from a cap on the
// resulting alpha to a cap on the boost; the question it left open is whether
// hoverDarken's 0.7 alone is enough feedback where the boost is inert.
//
//   node products/jbrowse-web/browser-tests/hover-probe.ts <alpha> [outdir]
import fs from 'node:fs'
import path from 'node:path'

import { BASE_CHROME_ARGS, displayPainted } from '@jbrowse/browser-test-utils'
import { PNG } from 'pngjs'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
  waitForDisplayPaint,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const alpha = Number(process.argv[2] ?? 0.35)
const outDir = process.argv[3] ?? '/tmp/hover-probe'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)
fs.mkdirSync(outDir, { recursive: true })

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
})

try {
  const page = await browser.newPage()
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          alpha,
          // the same local locus pair synteny.ts's regular-inverted test uses —
          // one big ribbon, which is what a hover cue wants to be judged on
          views: [
            { loc: 'Pp01:28,845,211..28,845,272', assembly: 'peach' },
            { loc: 'chr1:316,306..316,364', assembly: 'grape' },
          ],
        },
      ],
    },
    'test_data/grape_peach_synteny/config.json',
  )
  const painted = displayPainted('synteny_canvas')
  await waitForDisplayPaint(page, painted, 90000)
  await waitForDataLoaded(page, 90000)

  const canvas = (await page.waitForSelector(painted, { timeout: 30000 }))!
  const box = (await canvas.boundingBox())!
  console.log(`canvas box ${JSON.stringify(box)}  alpha=${alpha}`)

  // Clip rather than an element screenshot: hovering remounts the canvas, so a
  // handle taken before the move is detached by the time it is captured.
  const clip = { x: box.x, y: box.y, width: box.width, height: box.height }
  const shoot = async () => Buffer.from(await page.screenshot({ clip }))

  // park the pointer well away from any ribbon first
  await page.mouse.move(5, 5)
  await new Promise(r => setTimeout(r, 800))

  // Repainting clears the canvas before it redraws, so a capture taken at a
  // fixed delay after the move can land on a blank frame — which then reads as
  // a huge "difference" and is the one thing this probe must not report. So:
  // decode, require the frame to be stable across two reads, and require it to
  // still carry most of the ink the un-hovered frame had.
  const ink = (buf: Buffer) => {
    const png = PNG.sync.read(buf)
    let n = 0
    for (let i = 0; i < png.width * png.height; i++) {
      const o = i << 2
      n += 255 - Math.min(png.data[o]!, png.data[o + 1]!, png.data[o + 2]!)
    }
    return n
  }
  const pixelDiff = (a: Buffer, b: Buffer) => {
    const A = PNG.sync.read(a)
    const B = PNG.sync.read(b)
    let n = 0
    for (let i = 0; i < A.width * A.height; i++) {
      const o = i << 2
      if (
        A.data[o] !== B.data[o] ||
        A.data[o + 1] !== B.data[o + 1] ||
        A.data[o + 2] !== B.data[o + 2]
      ) {
        n++
      }
    }
    return n / (A.width * A.height)
  }
  // A settled frame is one that two consecutive reads agree on AND that carries
  // at least `minInk` — the repaint blanks the canvas first, and a blank frame
  // is perfectly stable while it lasts.
  const settledShot = async (minInk: number) => {
    for (let i = 0; i < 20; i++) {
      const a = await shoot()
      await new Promise(r => setTimeout(r, 300))
      const b = await shoot()
      if (pixelDiff(a, b) === 0 && ink(b) > minInk) {
        return b
      }
    }
    return null
  }

  const plain = await settledShot(1)
  if (!plain) {
    throw new Error('never got a settled non-blank un-hovered frame')
  }
  fs.writeFileSync(path.join(outDir, `plain-${alpha}.png`), plain)
  const plainInk = ink(plain)
  console.log(`plain ink ${plainInk}`)

  // Drive the model rather than the mouse. What is under test is the shader's
  // hover branch, not the pick engine that decides which feature the pointer is
  // over — and a mouse move that lands on no feature is indistinguishable from a
  // hover cue that renders nothing, which is exactly the question being asked.
  const setHover = (idx: number) =>
    page.evaluate(i => {
      const view = (window as any).JBrowseRootModel.session.views[0]
      const found: string[] = []
      const visit = (d: any, where: string) => {
        if (d && typeof d.setHoveredInstanceIdx === 'function') {
          d.setHoveredInstanceIdx(i)
          found.push(`${where}:${d.type ?? '?'} idx=${d.hoveredInstanceIdx}`)
        }
      }
      for (const [li, level] of (view.levels ?? []).entries()) {
        for (const d of level.displays ?? []) {
          visit(d, `level${li}`)
        }
        for (const t of level.tracks ?? []) {
          for (const d of t.displays ?? []) {
            visit(d, `level${li}.track`)
          }
        }
      }
      for (const d of view.displays ?? []) {
        visit(d, 'view')
      }
      for (const t of view.tracks ?? []) {
        for (const d of t.displays ?? []) {
          visit(d, 'view.track')
        }
      }
      return found
    }, idx)

  let hit: { idx: number; frac: number } | null = null
  for (const idx of [0, 1, 2, 3, 4]) {
    const found = await setHover(idx)
    if (idx === 0 && found.length === 0) {
      throw new Error('no display exposed setHoveredInstanceIdx — model moved?')
    }
    const shot = await settledShot(plainInk * 0.5)
    if (!shot) {
      console.log(`  idx=${idx} never settled`)
      continue
    }
    const frac = pixelDiff(plain, shot)
    console.log(`  idx=${idx} diff ${(frac * 100).toFixed(2)}%`)
    if (frac > 0.02) {
      hit = { idx, frac }
      fs.writeFileSync(path.join(outDir, `hover-${alpha}.png`), shot)
      break
    }
  }
  console.log(
    hit
      ? `hovered feature idx=${hit.idx} (${(hit.frac * 100).toFixed(1)}% of px changed)`
      : 'NO HOVER RENDERED',
  )
} finally {
  await browser.close()
  server.close()
}
