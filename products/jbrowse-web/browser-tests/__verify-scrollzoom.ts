import puppeteer from 'puppeteer'

const encodeSessionSpec = (o: object) =>
  encodeURIComponent(`spec-${JSON.stringify(o)}`)

const OUT =
  '/tmp/claude-1001/-home-cdiesh-src-jbrowse-components/99c813f1-54d7-4a7d-87d4-b08c7d376e69/scratchpad'

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_alignments'],
    },
  ],
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()
  const url = `http://localhost:3000/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=Verify`
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 })
  await delay(8000)

  await page.evaluate(() => {
    const w = window as unknown as { __c: { wheel: number; scroll: number } }
    w.__c = { wheel: 0, scroll: 0 }
    document.addEventListener('wheel', () => w.__c.wheel++, { capture: true })
    document.addEventListener('scroll', () => w.__c.scroll++, { capture: true })
  })

  const state = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="tracksContainer"]')
      let scroller: Element | undefined
      for (let n = el?.parentElement; n; n = n.parentElement) {
        if (
          n.scrollHeight > n.clientHeight &&
          /auto|scroll/.test(getComputedStyle(n).overflowY)
        ) {
          scroller = n
          break
        }
      }
      const w = window as unknown as { __c: { wheel: number; scroll: number } }
      return {
        scrollTop: scroller?.scrollTop ?? null,
        max: scroller ? scroller.scrollHeight - scroller.clientHeight : null,
        counts: { ...w.__c },
        hint: [...document.querySelectorAll('[role="status"]')].map(
          n => n.textContent,
        ),
      }
    })

  const box = await page.$eval('[data-testid="tracksContainer"]', el => {
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(box.x, box.y)

  await page.mouse.wheel({ deltaY: 200 })
  await delay(600)
  console.log('1st wheel  ', JSON.stringify(await state()))

  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel({ deltaY: 400 })
    await delay(120)
  }
  await delay(600)
  console.log('bottomed   ', JSON.stringify(await state()))

  await page.mouse.wheel({ deltaY: 400 })
  await delay(700)
  const dead = await state()
  console.log('dead wheel ', JSON.stringify(dead))
  await page.screenshot({ path: `${OUT}/hint-shown.png` })

  if (dead.hint.length) {
    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('[role="status"] button')].find(
        b => b.textContent.includes('Always zoom'),
      )
      if (!(btn instanceof HTMLElement)) {
        return false
      }
      btn.click()
      return true
    })
    await delay(500)
    const loc = () =>
      page.evaluate(
        () =>
          document.querySelector<HTMLInputElement>(
            'input[placeholder="Search for location"]',
          )?.value,
      )
    const before = await loc()
    await page.mouse.wheel({ deltaY: -300 })
    await delay(1500)
    console.log(
      `clicked=${clicked} hintAfter=${JSON.stringify((await state()).hint)} loc ${before} -> ${await loc()}`,
    )
  }

  await browser.close()
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
