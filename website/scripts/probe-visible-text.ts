// What text is actually ON SCREEN in a remote app, for picking a readiness gate
// that asserts something a reader could see.
//
//   node scripts/probe-visible-text.ts <spec name> [seconds] [needle]
//
// The companion to probe-loading-text.ts. That one answers "what is still
// saying Loading"; this one answers "what is there instead", which is the
// question you have once you know a negative gate is unpassable — puppeteer's
// `hidden` counts an element clipped by an ancestor's overflow as visible, so
// `waitForText … hidden` can wait forever on text nobody can see.
import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { videoSpecs } from './video-specs.ts'

const name = process.argv[2]
const seconds = Number(process.argv[3] ?? 30)
const needle = process.argv[4] ?? ''
const url = videoSpecs.find(s => s.name === name)?.url
if (!url?.startsWith('http')) {
  console.error(`no video spec named "${name}" with an absolute url`)
  process.exit(1)
}

const browser = await launch({
  headless: true,
  executablePath: findChromeExecutable(),
  args: BASE_CHROME_ARGS,
  protocolTimeout: 300000,
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
await new Promise(resolve => setTimeout(resolve, seconds * 1000))

const seen = await page.evaluate(want => {
  const out: string[] = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const text = (n.textContent ?? '').trim()
    const el = n.parentElement
    const r = el?.getBoundingClientRect()
    if (!text || !r || r.width === 0 || r.height === 0) {
      continue
    }
    // Inside the window, which is exactly what a clipped block is not.
    const onScreen =
      r.bottom > 0 &&
      r.top < window.innerHeight &&
      r.right > 0 &&
      r.left < window.innerWidth
    // A rect inside the window is still not a thing anyone can see: an ancestor
    // with `overflow: hidden` clips its descendants without changing their
    // boxes, and puppeteer's own `hidden` check has the same blind spot. Hit
    // testing the centre point is what the compositor actually did.
    const cx = Math.round(r.x + r.width / 2)
    const cy = Math.round(r.y + r.height / 2)
    const hit = document.elementFromPoint(cx, cy)
    const painted = Boolean(
      hit && el && (hit === el || el.contains(hit) || hit.contains(el)),
    )
    if (onScreen && (!want || text.includes(want))) {
      out.push(
        `${painted ? 'PAINTED' : 'clipped'} ${text.slice(0, 50)}   @${cx},${cy}`,
      )
    }
  }
  return out
}, needle)

console.log(seen.slice(0, 45).join('\n'))
console.log(
  `-- ${seen.length} on-screen node(s) matching ${JSON.stringify(needle)}`,
)
await browser.close()
