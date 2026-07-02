import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { launch } from 'puppeteer'

const BUILD = '/home/cdiesh/src/jbrowse-components/products/jbrowse-web/build'
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (p === '/') p = '/index.html'
  const fp = path.join(BUILD, p)
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('nf')
      return
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(fp)] || 'application/octet-stream',
    })
    res.end(data)
  })
})
await new Promise(r => server.listen(0, r))
const port = server.address().port

const URL_PATH = process.env.SPEC_URL
const browser = await launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--enable-unsafe-swiftshader',
  ],
})
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 600, deviceScaleFactor: 1 })
page.on('console', m => {
  const t = m.type()
  if (t === 'error' || t === 'warning')
    console.log('CONSOLE', t, m.text().slice(0, 400))
})
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 500)))
page.on('crash', () => console.log('PAGE CRASHED'))
page.on('error', e => console.log('PAGE ERROR EVENT', String(e).slice(0, 300)))
page.on('requestfailed', r =>
  console.log('REQFAIL', r.url().slice(0, 120), r.failure()?.errorText),
)
page.on('response', r => {
  if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(0, 120))
})

await page.goto(`http://localhost:${port}/${URL_PATH}`, {
  waitUntil: 'networkidle0',
  timeout: 60000,
})
console.log('--- loaded, waiting for PTEN ---')
await page
  .waitForFunction(
    () =>
      [...document.querySelectorAll('*')].some(
        e => e.textContent?.trim() === 'PTEN',
      ),
    { timeout: 60000 },
  )
  .catch(e => console.log('no PTEN', e.message))
await new Promise(r => setTimeout(r, 2000))
await page.screenshot({ path: '/tmp/step1_loaded.png' })
console.log('step1 saved')

// right-click PTEN
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(
    e => e.textContent?.trim() === 'PTEN',
  )
  if (!el) return false
  const r = el.getBoundingClientRect()
  const ev = new MouseEvent('contextmenu', {
    bubbles: true,
    clientX: r.x + 2,
    clientY: r.y + 2,
  })
  el.dispatchEvent(ev)
  return true
})
console.log('rightclick dispatched', clicked)
await new Promise(r => setTimeout(r, 1500))
await page.screenshot({ path: '/tmp/step2_menu.png' })

async function clickText(txt) {
  return page.evaluate(t => {
    const el = [...document.querySelectorAll('li,button,span,div')].find(
      e => e.textContent?.trim() === t,
    )
    if (!el) return false
    el.click()
    return true
  }, txt)
}
console.log('click Collapse introns', await clickText('Collapse introns'))
await new Promise(r => setTimeout(r, 1500))
await page.screenshot({ path: '/tmp/step3_dialog.png' })
const shot = async p => {
  try {
    await page.screenshot({ path: p })
  } catch (e) {
    console.log('SHOT FAIL', p, String(e).slice(0, 80))
  }
}
console.log(
  'click Replace current view',
  await clickText('Replace current view'),
)

// poll status over time; catch the crash reason
for (let i = 0; i < 120; i++) {
  await new Promise(r => setTimeout(r, 250))
  const st = await page
    .evaluate(() => {
      const ov = document.querySelector('[data-testid="loading-overlay"]')
      const vis = ov && ov.getBoundingClientRect().width > 0
      return {
        present: !!ov,
        vis,
        txt: ov?.textContent?.slice(0, 80),
        body: document.body.innerText.slice(0, 60),
      }
    })
    .catch(e => ({ EVAL_FAIL: String(e).slice(0, 120) }))
  const mem = await page
    .metrics()
    .then(m => Math.round(m.JSHeapUsedSize / 1e6))
    .catch(() => '?')
  console.log(`t+${i}s heap=${mem}MB`, JSON.stringify(st))
  if (st.EVAL_FAIL) break
}
await shot('/tmp/step5_final.png')
console.log('done')
await browser.close()
server.close()
