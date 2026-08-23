// Is the LGV's sticky chrome stack telling the truth about itself?
//
// Three sticky siblings — the view title, the LGV header, the scalebar — and
// each one's `top` is arithmetic over the heights of the ones above it
// (`rubberbandTop`, `pinnedTracksTop`). That arithmetic is only true while every
// box actually renders at the constant it is summed from, and nothing in a diff,
// a typecheck or a jsdom test can see it break: jsdom computes no layout.
//
// Two ways it has broken, both pinned here:
//
//   - a header that renders nothing for a frame. It was a lazy chunk with
//     `fallback={null}`, so the box measured 0 while the scalebar still pinned
//     at 96 and floated 66px down into the first track. Sampled every frame
//     under throttling, since the window is a few hundred ms.
//   - a pinned-track block capped against `100vh`. The scroll port is not the
//     window — it sits under the app bar here, and is a dockview cell or the
//     host's box elsewhere — so the cap that exists to stop pinned tracks
//     burying the unpinned stack was a full app-bar too generous.
//   - a chrome box pinned to the constant the offsets sum. `VIEW_HEADER_HEIGHT`
//     and the LGV header bar's height were written into the CSS by #4237 so
//     that the sums would be true, and a box that cannot grow clips its own
//     content: at a 24px root font the view header overflowed by 2px, with its
//     title row squeezed from the 35.7px it wanted into 28. Both are minimums
//     now and publish what they measure, so the sweep below walks the root font
//     size and asks that the scalebar still land flush.
//
//     node browser-tests/probe-sticky-chrome.ts
//     PORT=3001 CPU=6 node browser-tests/probe-sticky-chrome.ts
import puppeteer from 'puppeteer'

const PORT = Number(process.env.PORT || 3000)
const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_alignments', 'volvox_maf', 'volvox_filtered_vcf'],
    },
  ],
}
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// throttled on purpose: at full speed the chunk lands inside one frame and a
// null fallback looks identical to a correct one
const CPU = Number(process.env.CPU || 4)
const LATENCY = Number(process.env.LAT || 300)

function sampler() {
  const samples: unknown[] = []
  ;(window as any).__stickySamples = samples
  const tick = () => {
    const tc = document.querySelector('[data-testid="tracksContainer"]')
    const rb = document.querySelector('[data-testid="rubberband_controls"]')
    const header = tc?.parentElement?.previousElementSibling
    if (header && rb) {
      samples.push({
        t: Math.round(performance.now()),
        headerHeight: +header.getBoundingClientRect().height.toFixed(1),
        headerChildren: header.childElementCount,
        gap: +(
          rb.getBoundingClientRect().top - header.getBoundingClientRect().bottom
        ).toFixed(1),
      })
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function readPinnedCap() {
  const tc = document.querySelector('[data-testid="tracksContainer"]')!
  const pinned = document.querySelector<HTMLElement>(
    '[data-testid="tracksContainer"] .MuiPaper-elevation6',
  )!
  let node: Element | null = tc.parentElement
  while (
    node &&
    !(
      node.scrollHeight > node.clientHeight &&
      /auto|scroll/.test(getComputedStyle(node).overflowY)
    )
  ) {
    node = node.parentElement
  }
  const port = node as HTMLElement
  const style = getComputedStyle(pinned)
  return {
    portHeight: port.clientHeight,
    windowHeight: window.innerHeight,
    stickyTop: parseFloat(style.top),
    maxHeight: parseFloat(style.maxHeight),
  }
}

// The one invariant, read off the DOM at whatever size the chrome came out:
// the scalebar's top is the header's bottom. Everything else here is a way of
// making that fail.
function readChromeStack() {
  const tc = document.querySelector('[data-testid="tracksContainer"]')!
  const header = tc.parentElement!.previousElementSibling!
  const rb = document.querySelector('[data-testid="rubberband_controls"]')!
  const viewHeader = tc.closest('[data-testid^="view-container-"]')!
    .firstElementChild as HTMLElement
  return {
    viewHeaderHeight: +viewHeader.getBoundingClientRect().height.toFixed(2),
    viewHeaderOverflow: viewHeader.scrollHeight - viewHeader.clientHeight,
    gap: +(
      rb.getBoundingClientRect().top - header.getBoundingClientRect().bottom
    ).toFixed(2),
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== '0',
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()
  const client = await page.createCDPSession()
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: LATENCY,
    downloadThroughput: 200 * 1024,
    uploadThroughput: 200 * 1024,
  })
  await client.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  await page.evaluateOnNewDocument(sampler)

  const url = `http://localhost:${PORT}/?config=test_data/volvox/config.json&session=${encodeURIComponent(`spec-${JSON.stringify(spec)}`)}&sessionName=StickyChrome`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForSelector('[data-testid="rubberband_controls"]', {
    timeout: 180000,
  })
  await delay(5000)

  const samples = (await page.evaluate(
    () => (window as any).__stickySamples,
  )) as {
    t: number
    headerHeight: number
    headerChildren: number
    gap: number
  }[]
  const detached = samples.filter(s => s.gap !== 0)
  console.log(`chrome stack: ${samples.length} frames sampled`)
  if (detached.length) {
    console.log(`  FAIL ${detached.length} frames with the scalebar detached:`)
    for (const s of detached.slice(0, 5)) {
      console.log(
        `    t=${s.t} header ${s.headerHeight}px (${s.headerChildren} children), scalebar ${s.gap}px below it`,
      )
    }
  } else {
    console.log('  PASS scalebar flush under the header in every frame')
  }

  await page.evaluate(() => {
    const view = (window as any).JBrowseSession.views[0]
    view.tracks[0].setPinned(true)
    view.tracks[1]?.setPinned(true)
  })
  await delay(1500)
  const cap = await page.evaluate(readPinnedCap)
  const available = cap.portHeight - cap.stickyTop
  const wrong = cap.windowHeight - cap.stickyTop
  console.log(
    `pinned cap: port ${cap.portHeight}px, window ${cap.windowHeight}px, sticky top ${cap.stickyTop}px`,
  )
  console.log(
    `  max-height ${cap.maxHeight}px, port allows ${available}px (100vh would allow ${wrong}px)`,
  )
  console.log(
    cap.maxHeight === available
      ? '  PASS capped against the scroll port'
      : `  FAIL off by ${cap.maxHeight - available}px`,
  )

  // unpin, so the font sweep measures the plain stack
  await page.evaluate(() => {
    const view = (window as any).JBrowseSession.views[0]
    for (const t of view.tracks) {
      t.setPinned(false)
    }
  })
  let fontFailures = 0
  console.log('chrome stack across root font sizes:')
  for (const fontSize of [16, 18, 20, 24]) {
    await page.evaluate(f => {
      document.documentElement.style.fontSize = `${f}px`
    }, fontSize)
    await delay(600)
    const s = await page.evaluate(readChromeStack)
    // sub-pixel: the var is published from offsetHeight, which is rounded
    const ok = Math.abs(s.gap) <= 1 && s.viewHeaderOverflow === 0
    if (!ok) {
      fontFailures++
    }
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'} ${String(fontSize).padStart(2)}px root: view header ${s.viewHeaderHeight}px (overflow ${s.viewHeaderOverflow}), scalebar ${s.gap}px below the header`,
    )
  }

  await browser.close()
  process.exitCode =
    detached.length || cap.maxHeight !== available || fontFailures ? 1 : 0
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
