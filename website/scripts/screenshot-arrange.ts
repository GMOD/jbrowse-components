// Lays several finished frames out as one figure: a compose spec's parts, or a
// staged spec's stages. The callouts drawn over the result anchor to each frame
// as `[data-part="N"]`.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  BASE_CHROME_ARGS,
  drawAnnotations,
  findChromeExecutable,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { IM, IM_REPRODUCIBLE, imageSize } from './image-pipeline.ts'

import type { Annotation, FrameLayout } from './screenshot-spec-types.ts'

// Two app windows sharing an edge read as one window with a seam down it; a
// stack needs no gutter, since each frame's own title bar separates it.
const GRID_GUTTER_PX = 24

interface Size {
  width: number
  height: number
}

interface FrameBox extends Size {
  left: number
  top: number
}

// Writes the arranged figure to `out` and leaves `files` untouched.
export async function arrangeFrames(
  files: string[],
  out: string,
  layout: FrameLayout & { annotations?: Annotation[] },
) {
  const scratch: string[] = []
  const temp = (label: string) => {
    const f = out.replace(/\.png$/, `-${label}-${scratch.length}.png`)
    scratch.push(f)
    return f
  }
  try {
    const sizes = await Promise.all(files.map(f => imageSize(f)))
    const boxes =
      (layout.columns ?? 1) > 1
        ? appendGrid(files, sizes, out, layout, temp)
        : appendStack(files, sizes, out, layout, temp)
    if (layout.annotations?.length) {
      await overlayOnComposition(out, layout.annotations, boxes)
    }
  } finally {
    for (const f of scratch) {
      fs.rmSync(f, { force: true })
    }
  }
}

function magick(args: string[], out: string) {
  execFileSync(IM, [...args, ...IM_REPRODUCIBLE, out])
}

// Each frame bordered by half a gutter on every side, each row `+append`ed
// top-aligned, then the rows `-append`ed left-aligned, so a short last row
// keeps the frames on the columns above it.
function appendGrid(
  files: string[],
  sizes: Size[],
  out: string,
  { columns = 1, gutter = GRID_GUTTER_PX }: FrameLayout,
  temp: (label: string) => string,
) {
  const boxes: FrameBox[] = []
  const rowFiles: string[] = []
  let top = 0
  for (let start = 0; start < files.length; start += columns) {
    const row = sizes.slice(start, start + columns)
    let left = 0
    for (const size of row) {
      boxes.push({ ...size, left: left + gutter / 2, top: top + gutter / 2 })
      left += size.width + gutter
    }
    top += Math.max(...row.map(s => s.height)) + gutter
    const framed = files.slice(start, start + columns).map(f => {
      const t = temp('frame')
      magick([f, '-bordercolor', 'white', '-border', `${gutter / 2}`], t)
      return t
    })
    const rowFile = temp('row')
    magick([...framed, '+append'], rowFile)
    rowFiles.push(rowFile)
  }
  magick(
    [...rowFiles, '-background', 'white', '-gravity', 'west', '-append'],
    out,
  )
  return boxes
}

// A gutter spliced above each frame after the first, so the figure gains no
// margin at its own top or bottom, and `sideMargin` bordered down both sides of
// every frame.
function appendStack(
  files: string[],
  sizes: Size[],
  out: string,
  { gutter = 0, sideMargin = 0 }: FrameLayout,
  temp: (label: string) => string,
) {
  const padded = files.map((f, i) => {
    let src = f
    if (gutter > 0 && i > 0) {
      const t = temp('frame')
      magick([src, '-background', 'white', '-splice', `0x${gutter}+0+0`], t)
      src = t
    }
    if (sideMargin > 0) {
      const t = temp('frame')
      magick([src, '-bordercolor', 'white', '-border', `${sideMargin}x0`], t)
      src = t
    }
    return src
  })
  magick([...padded, '-append'], out)
  let top = 0
  return sizes.map(size => {
    const box = { ...size, left: sideMargin, top }
    top += size.height + gutter
    return box
  })
}

// Draws callouts over a flat composition by opening a page holding the image
// and one absolutely positioned element per frame, so the same overlay every
// other figure uses can anchor to `[data-part="N"]`. Sized 1:1 with the PNG at
// deviceScaleFactor 1, so the capture is the composition unresampled.
async function overlayOnComposition(
  renderPath: string,
  annotations: Annotation[],
  boxes: FrameBox[],
) {
  const { width, height } = await imageSize(renderPath)
  // a file:// page, since an about:blank one cannot load a file:// image
  const pagePath = `${renderPath}.html`
  fs.writeFileSync(
    pagePath,
    `<!doctype html><html><body style="margin:0;background:#fff">
<img src="${path.basename(renderPath)}" style="display:block;width:${width}px;height:${height}px">
${boxes
  .map(
    (b, i) =>
      `<div data-part="${i}" style="position:absolute;left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px"></div>`,
  )
  .join('\n')}
</body></html>`,
  )
  // `--window-size` is load-bearing: a viewport wider than the window
  // screenshots as the window's leftmost slice tiled across the frame, and a
  // composition is routinely 3000+ px wide. The slack covers the headless
  // chrome drawn inside the outer window; at an exact fit the bottom ~60 px
  // tiled.
  const browser = await launch({
    headless: true,
    executablePath: findChromeExecutable(),
    args: [...BASE_CHROME_ARGS, `--window-size=${width + 100},${height + 300}`],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    await page.goto(`file://${pagePath}`, { waitUntil: 'load' })
    await drawAnnotations(page, annotations)
    await page.screenshot({ path: renderPath })
  } finally {
    await browser.close()
    fs.rmSync(pagePath, { force: true })
  }
}
