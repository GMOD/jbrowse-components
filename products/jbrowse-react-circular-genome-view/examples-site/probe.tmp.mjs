import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

import puppeteer from 'puppeteer'
import handler from 'serve-handler'

const here = path.dirname(fileURLToPath(import.meta.url))
const base = process.argv[2]
const slug = process.argv[3]
const out = process.argv[4]
const distDir = path.join(here, 'dist')

const server = http.createServer((req, res) => {
  if (req.url?.startsWith(base)) {
    req.url = req.url.slice(base.length) || '/'
  }
  void handler(req, res, { public: distDir })
})
await new Promise(r => server.listen(0, r))
const { port } = server.address()
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
page.on('console', m => {
  if (m.type() === 'error' || m.type() === 'warn') {
    console.log('console', m.type(), m.text().slice(0, 300))
  }
})
page.on('pageerror', e => console.log('pageerror', e.message))
await page.setViewport({ width: 1440, height: 900 })
await page.goto(`http://localhost:${port}${base}/${slug}/`, {
  waitUntil: 'networkidle2',
  timeout: 90000,
})
await new Promise(r => setTimeout(r, Number(process.argv[5] ?? 9000)))
const sectionId = process.argv[6]
if (sectionId) {
  await page.evaluate(id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'instant' })
  }, sectionId)
  await new Promise(r => setTimeout(r, 3000))
}
console.log(
  await page.evaluate(() =>
    JSON.stringify({
      rings: [
        ...document.querySelectorAll('[data-testid=circular-ring-canvas]'),
      ].map(c => ({
        drawn: c.getAttribute('data-display-drawn'),
        w: c.width,
        h: c.height,
      })),
      text: [...document.querySelectorAll('.demo')].map(d =>
        d.innerText.slice(0, 400),
      ),
    }),
  ),
)
await page.screenshot({ path: out })
await browser.close()
server.close()
