// What is still saying "Loading" on a page a tour is waiting to settle.
//
//   node scripts/probe-loading-text.ts <spec name|url> [seconds]
//
// `waitForText … hidden` reports only that the text is still there, which for a
// tour filmed against a remote app is the least useful half of the answer: a
// track that never fetched and a stray placeholder in some other panel fail it
// the same way. This names every node carrying the word, with the track or view
// it sits in, once a second, so the failure comes with the thing that caused it.
import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  isBrowserConsoleNoise,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { describeNetwork, trackNetwork } from './screenshot-page.ts'
import { videoSpecs } from './video-specs.ts'

const target = process.argv[2]
const seconds = Number(process.argv[3] ?? 90)
if (!target) {
  console.error('usage: probe-loading-text.ts <spec name|url> [seconds]')
  process.exit(1)
}
// A tour's url is a 500-character session spec, so naming the tour is the only
// usable door.
const url = target.startsWith('http')
  ? target
  : (videoSpecs.find(s => s.name === target)?.url ?? '')
if (!url) {
  console.error(`no video spec named "${target}"`)
  process.exit(1)
}
if (!url.startsWith('http')) {
  console.error(
    `${target} films the local build; this probe wants an absolute url`,
  )
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

const failures: string[] = []
page.on('requestfailed', req => {
  failures.push(`${req.failure()?.errorText ?? 'failed'} ${req.url()}`)
})
page.on('response', res => {
  if (res.status() >= 400) {
    failures.push(`HTTP ${res.status()} ${res.url()}`)
  }
})
// The app's own account of what it is doing. A track stuck on "Loading" with no
// failed request has usually said why here — and a worker that never came up
// says it here and nowhere else.
page.on('console', msg => {
  const text = msg.text()
  if (!isBrowserConsoleNoise(text)) {
    console.log(`  browser[${msg.type()}]: ${text.slice(0, 300)}`)
  }
})
page.on('pageerror', (err: unknown) => {
  console.log(
    `  browser[pageerror]: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`.slice(
      0,
      600,
    ),
  )
})
const net = trackNetwork(page)

console.log(`loading ${url.slice(0, 120)}…`)
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })

for (let i = 0; i < seconds; i++) {
  await new Promise(r => setTimeout(r, 1000))
  const found = await page.evaluate(() => {
    // The deepest node holding the word, so the report names the spinner's own
    // label rather than every ancestor up to <body>.
    const hits: {
      text: string
      where: string
      visible: boolean
      box: string
      opacity: string
    }[] = []
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!/loading/i.test(n.textContent ?? '')) {
        continue
      }
      let el = n.parentElement
      const trail: string[] = []
      while (el && trail.length < 12) {
        const id = el.dataset.testid
        if (id) {
          trail.push(id)
        }
        el = el.parentElement
      }
      const host = n.parentElement
      const rect = host?.getBoundingClientRect()
      const style = host ? getComputedStyle(host) : undefined
      // Whether a human could actually SEE it, which is what
      // `waitForText … hidden` is really asking. A placeholder left in the DOM
      // at zero size, or under opacity 0, fails a text scan and fails nobody
      // looking at the page.
      const visible = Boolean(
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        style &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        Number(style.opacity) > 0.01 &&
        host?.offsetParent !== null,
      )
      hits.push({
        text: (n.textContent ?? '').trim().slice(0, 80),
        where: trail.join(' < ') || '(no testid ancestor)',
        visible,
        box: rect
          ? `${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.x)},${Math.round(rect.y)}`
          : '-',
        opacity: style?.opacity ?? '-',
      })
    }
    return {
      hits,
      visibleHits: hits.filter(h => h.visible).length,
      phase:
        document.querySelector<HTMLElement>('[data-app-phase]')?.dataset
          .appPhase,
      drawn: document.querySelectorAll('[data-display-drawn="true"]').length,
      displays: document.querySelectorAll('[data-testid^="display-"]').length,
    }
  })
  // An empty page has no "Loading" in it either, so a clear before the app has
  // put any display on screen is the probe outrunning the boot rather than the
  // app settling. That is the shape of the false negative this is for.
  const booted = found.displays > 0
  if (booted && found.visibleHits === 0) {
    console.log(
      `t+${i + 1}s  NOTHING VISIBLE SAYS LOADING — ${found.displays} display(s), ` +
        `${found.drawn} drawn; ${found.hits.length} HIDDEN node(s) still carry the word`,
    )
    for (const hit of found.hits.slice(0, 6)) {
      console.log(
        `        hidden: "${hit.text}" box=${hit.box} opacity=${hit.opacity} in ${hit.where}`,
      )
    }
    break
  }
  if (i % 10 === 0 || i < 5) {
    console.log(
      `t+${i + 1}s  ${booted ? '' : '[not booted] '}phase=${found.phase ?? 'none'} ` +
        `drawn=${found.drawn} displays=${found.displays} hits=${found.hits.length} ` +
        `visible=${found.visibleHits}`,
    )
    for (const hit of found.hits.slice(0, 6)) {
      console.log(
        `        "${hit.text}" vis=${hit.visible} box=${hit.box} in ${hit.where}`,
      )
    }
  }
}

// The picture, with every node still carrying the word outlined in it, because
// "is it visible" is a question about layout that a rect cannot settle on its
// own: an element can have a box, an opacity and an offsetParent and still sit
// outside the window its view scrolls.
await page.evaluate(() => {
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (/loading/i.test(n.textContent ?? '') && n.parentElement) {
      n.parentElement.style.outline = '3px solid red'
      n.parentElement.style.background = 'rgba(255,0,0,0.25)'
    }
  }
})
const shot = `/tmp/probe-loading-${Date.now()}.png`
await page.screenshot({ path: shot, fullPage: true })
console.log(`\nscreenshot ${shot}`)

const netReport = describeNetwork(net)
if (netReport) {
  console.log(`\n${netReport}`)
}
if (failures.length > 0) {
  console.log(`\n${failures.length} failed request(s):`)
  for (const f of [...new Set(failures)].slice(0, 20)) {
    console.log(`  ${f}`)
  }
}
await browser.close()
