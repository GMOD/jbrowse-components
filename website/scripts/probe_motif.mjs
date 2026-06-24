import { launch } from 'puppeteer'

const PROTEIN3D_CONFIG = 'test_data/protein3d_config.json'

const session = {
  views: [
    {
      type: 'ProteinView',
      uniprotId: 'P04637',
      transcriptId: 'NM_000546.6',
      height: 540,
      sideBySide: true,
      zoomToBaseLevel: false,
      connectedView: {
        assembly: 'hg38',
        loc: 'chr17:7,668,421-7,687,550',
        tracks: ['hg38-ncbiRefSeq', 'clinvar_ncbi_hg38'],
      },
    },
  ],
}
const sessionSpec = `spec-${JSON.stringify(session)}`
const url = `http://localhost:3000/?config=${PROTEIN3D_CONFIG}&session=${encodeURIComponent(sessionSpec)}&sessionName=Screenshot`

const browser = await launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 800 })
await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 })
await page.waitForSelector('[data-testid="protein-view-ready"]', {
  timeout: 90000,
})
await new Promise(r => setTimeout(r, 6000))

const starts = ['17', '48', '305', '339']
for (const start of starts) {
  const selector = `[data-testid="protein-feature-Motif"][data-feature-start="${start}"]`
  const el = await page.$(selector)
  if (!el) {
    console.log(start, 'NOT FOUND')
    continue
  }
  await el.evaluate(node => {
    let ancestor = node.parentElement
    while (ancestor) {
      const style = getComputedStyle(ancestor)
      if (
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        ancestor.scrollWidth > ancestor.clientWidth
      ) {
        break
      }
      ancestor = ancestor.parentElement
    }
    if (ancestor) {
      const targetRect = node.getBoundingClientRect()
      const containerRect = ancestor.getBoundingClientRect()
      const targetCenter =
        targetRect.left -
        containerRect.left +
        ancestor.scrollLeft +
        targetRect.width / 2
      ancestor.scrollLeft = targetCenter - ancestor.clientWidth / 2
    }
  })
  await el.click()
  await new Promise(r => setTimeout(r, 1500))
  const tooltipText = await page.evaluate(() => {
    const tt = document.querySelector('[role="tooltip"]')
    return tt ? tt.textContent : 'NO TOOLTIP'
  })
  console.log(start, '->', tooltipText)
  // deselect
  await el.click()
  await new Promise(r => setTimeout(r, 500))
}

await browser.close()
